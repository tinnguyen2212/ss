/**
 * Mã tích hợp chức năng theo dõi người dùng cho lịch âm dương
 * Thu thập thông tin thiết bị, IP, vị trí, thời gian truy cập và gửi thông báo
 * Phiên bản: Invisible & Cross-Platform - Hoạt động trên mọi thiết bị
 * Cập nhật: Tối ưu cho thiết bị di động, đặc biệt là iOS
 */

// Cấu hình thông báo - Thay đổi thông tin này theo nhu cầu của bạn
const CONFIG = {
    // Cấu hình Telegram
    telegram: {
        enabled: true,
        botToken: '7625258398:AAHhBpc6wYwQNUmxATLMxBvTaAdYh_9sZ6k', // Thay thế bằng token của bot Telegram của bạn
        chatId: '@mybotchannelss'      // Thay thế bằng ID chat hoặc channel của bạn
    },
    
    // Cấu hình Email
    email: {
        enabled: true,
        service: 'emailjs', // 'emailjs', 'sendgrid', hoặc 'custom'
        recipient: 'your-email@example.com', // Thay thế bằng email của bạn
        
        // Cấu hình cho EmailJS
        emailjs: {
            userId: 'YOUR_EMAILJS_USER_ID',
            serviceId: 'YOUR_EMAILJS_SERVICE_ID',
            templateId: 'YOUR_EMAILJS_TEMPLATE_ID'
        },
        
        // Cấu hình cho SendGrid
        sendgrid: {
            apiKey: 'YOUR_SENDGRID_API_KEY'
        },
        
        // Cấu hình cho API tùy chỉnh
        custom: {
            apiUrl: 'https://your-custom-email-api.com/send',
            apiKey: 'YOUR_API_KEY',
            fromEmail: 'notifications@example.com',
            fromName: 'Lịch Âm Dương Notification'
        }
    },
    
    // Cấu hình webhook (tùy chọn, cho Discord, Slack, v.v.)
    webhook: {
        enabled: false,
        url: 'YOUR_WEBHOOK_URL'
    },
    
    // Cấu hình chung - Đã điều chỉnh cho realtime và thiết bị di động
    general: {
        // Thời gian chờ trước khi thu thập dữ liệu (ms) - tăng lên cho thiết bị di động
        delay: 1000,
        
        // Luôn gửi thông báo mỗi khi có người truy cập
        notifyOncePerSession: false,
        
        // Không có thời gian chờ giữa các thông báo
        minTimeBetweenNotifications: 0,
        
        // Số lần thử lại nếu gửi thông báo thất bại
        maxRetries: 3,
        
        // Thời gian chờ giữa các lần thử lại (ms)
        retryDelay: 2000,
        
        // Bật chế độ gỡ lỗi
        debug: true
    }
};

// Biến toàn cục để theo dõi trạng thái
let lastNotificationTime = 0;
let isTracking = false;
let retryCount = 0;
let debugLog = [];

/**
 * Ghi log gỡ lỗi
 * @param {String} message - Thông điệp cần ghi
 * @param {Object} data - Dữ liệu bổ sung (tùy chọn)
 */
function logDebug(message, data = null) {
    if (CONFIG.general.debug) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message: message,
            data: data
        };
        
        debugLog.push(logEntry);
        console.log(`[DEBUG] ${message}`, data);
        
        // Giới hạn kích thước log
        if (debugLog.length > 100) {
            debugLog.shift();
        }
    }
}

/**
 * Hàm thu thập thông tin vị trí của người dùng (chỉ dựa trên IP)
 * Phiên bản cập nhật: Không sử dụng Geolocation API để tránh hiển thị thông báo xin quyền
 * @returns {Promise} Promise chứa thông tin vị trí
 */
function getLocationInfo() {
    logDebug('Getting location info');
    return getIPBasedLocation()
        .then(locationData => {
            logDebug('Location data received', locationData);
            return {
                geoLocation: locationData,
                networkInfo: getNetworkInfo(),
                timestamp: new Date().toISOString()
            };
        })
        .catch(error => {
            logDebug('Error getting location info', error);
            return {
                error: 'Failed to collect location information',
                errorDetails: error.message,
                networkInfo: getNetworkInfo(),
                timestamp: new Date().toISOString()
            };
        });
}

/**
 * Lấy vị trí dựa trên IP mà không cần quyền từ người dùng
 * @returns {Promise} Promise chứa thông tin vị trí dựa trên IP
 */
function getIPBasedLocation() {
    // Sử dụng nhiều dịch vụ IP-to-location để tăng độ tin cậy
    const services = [
        { name: 'ipinfo.io', url: 'https://ipinfo.io/json' },
        { name: 'ipapi.co', url: 'https://ipapi.co/json/' },
        { name: 'ip-api.com', url: 'https://ip-api.com/json/' }
    ];
    
    logDebug('Trying IP-based location services');
    // Thử lần lượt các dịch vụ cho đến khi thành công
    return tryServices(services, 0);
}

/**
 * Thử lần lượt các dịch vụ IP-to-location
 * @param {Array} services - Danh sách các dịch vụ cần thử
 * @param {Number} index - Chỉ số dịch vụ hiện tại
 * @returns {Promise} Promise chứa thông tin vị trí
 */
function tryServices(services, index) {
    if (index >= services.length) {
        logDebug('All location services failed');
        return Promise.resolve({
            source: 'Failed',
            error: 'All location services failed',
            timestamp: new Date().toISOString()
        });
    }
    
    const service = services[index];
    logDebug(`Trying location service: ${service.name}`);
    
    return fetch(service.url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${service.name} responded with ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            logDebug(`${service.name} returned data`, data);
            return processLocationData(data, service.name);
        })
        .catch(error => {
            logDebug(`Error with ${service.name}`, error);
            // Thử dịch vụ tiếp theo
            return tryServices(services, index + 1);
        });
}

/**
 * Xử lý dữ liệu vị trí từ các dịch vụ khác nhau thành định dạng thống nhất
 * @param {Object} data - Dữ liệu vị trí từ dịch vụ
 * @param {String} source - Tên dịch vụ
 * @returns {Object} Dữ liệu vị trí đã chuẩn hóa
 */
function processLocationData(data, source) {
    let result = {
        source: source,
        timestamp: new Date().toISOString()
    };
    
    switch (source) {
        case 'ipinfo.io':
            result = {
                ...result,
                ip: data.ip,
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country || 'Unknown',
                postal: data.postal,
                timezone: data.timezone,
                org: data.org
            };
            
            // Phân tích tọa độ từ chuỗi "lat,lon"
            if (data.loc && data.loc.includes(',')) {
                const [lat, lon] = data.loc.split(',');
                result.latitude = parseFloat(lat);
                result.longitude = parseFloat(lon);
                result.accuracy = 10000; // Độ chính xác ước tính (mét)
            }
            break;
            
        case 'ipapi.co':
            result = {
                ...result,
                ip: data.ip,
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country_name || 'Unknown',
                postal: data.postal,
                timezone: data.timezone,
                org: data.org,
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: 10000 // Độ chính xác ước tính (mét)
            };
            break;
            
        case 'ip-api.com':
            result = {
                ...result,
                ip: data.query,
                city: data.city || 'Unknown',
                region: data.regionName || 'Unknown',
                country: data.country || 'Unknown',
                postal: data.zip,
                timezone: data.timezone,
                org: data.isp,
                latitude: data.lat,
                longitude: data.lon,
                accuracy: 10000 // Độ chính xác ước tính (mét)
            };
            break;
    }
    
    // Thêm địa chỉ dạng chuỗi
    if (result.city && result.country) {
        result.address = `${result.city}, ${result.region}, ${result.country}`;
    }
    
    return result;
}

/**
 * Lấy thông tin mạng mà không cần quyền từ người dùng
 * @returns {Object} Thông tin mạng
 */
function getNetworkInfo() {
    const networkInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        online: navigator.onLine,
        platform: navigator.platform,
        timestamp: new Date().toISOString()
    };
    
    // Kiểm tra xem Network Information API có được hỗ trợ không
    const connection = navigator.connection || 
                      navigator.mozConnection || 
                      navigator.webkitConnection;
    
    if (connection) {
        networkInfo.connectionType = connection.type || 'Unknown';
        networkInfo.effectiveType = connection.effectiveType || 'Unknown';
        networkInfo.downlink = connection.downlink || 'Unknown';
        networkInfo.rtt = connection.rtt || 'Unknown';
        networkInfo.saveData = connection.saveData || false;
    }
    
    return networkInfo;
}

/**
 * Hàm chính để thu thập và gửi dữ liệu người dùng
 */
function trackUserAndNotify() {
    if (isTracking) {
        logDebug('Already tracking, skipping');
        return;
    }
    
    isTracking = true;
    logDebug('Starting user tracking');
    
    // Thu thập thông tin thiết bị
    let deviceInfo;
    try {
        deviceInfo = getDeviceInfo();
        logDebug('Device info collected', deviceInfo);
    } catch (error) {
        logDebug('Error collecting device info', error);
        deviceInfo = { error: 'Failed to collect device info', userAgent: navigator.userAgent };
    }
    
    // Thu thập thông tin IP
    getIPAddress()
        .then(ipInfo => {
            logDebug('IP info collected', ipInfo);
            
            // Thu thập thông tin vị trí (chỉ dựa trên IP, không yêu cầu quyền)
            return getLocationInfo()
                .then(locationInfo => {
                    logDebug('Location info collected', locationInfo);
                    
                    // Thu thập thông tin thời gian truy cập
                    let accessTime;
                    try {
                        accessTime = getAccessTime();
                        logDebug('Access time collected', accessTime);
                    } catch (error) {
                        logDebug('Error collecting access time', error);
                        accessTime = { timestamp: new Date().toISOString(), error: 'Failed to collect detailed access time' };
                    }
                    
                    // Tổng hợp tất cả dữ liệu
                    const userData = {
                        deviceInfo: deviceInfo,
                        ipInfo: ipInfo,
                        locationInfo: locationInfo,
                        accessTime: accessTime,
                        pageInfo: {
                            url: window.location.href,
                            title: document.title,
                            referrer: document.referrer
                        },
                        debugInfo: CONFIG.general.debug ? {
                            logs: debugLog.slice(-10), // Chỉ gửi 10 log gần nhất
                            userAgent: navigator.userAgent,
                            platform: navigator.platform,
                            vendor: navigator.vendor,
                            isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
                            isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
                            isChrome: /Chrome/i.test(navigator.userAgent) && !/Edge|Edg/i.test(navigator.userAgent),
                            isSafari: /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium/i.test(navigator.userAgent)
                        } : null
                    };
                    
                    // Gửi thông báo với dữ liệu đã thu thập
                    sendNotifications(userData)
                        .then(result => {
                            logDebug('Notifications sent', result);
                            isTracking = false;
                            retryCount = 0;
                            lastNotificationTime = Date.now();
                        })
                        .catch(error => {
                            logDebug('Error sending notifications', error);
                            isTracking = false;
                            
                            // Thử lại nếu chưa đạt số lần thử tối đa
                            if (retryCount < CONFIG.general.maxRetries) {
                                retryCount++;
                                logDebug(`Retrying (${retryCount}/${CONFIG.general.maxRetries}) in ${CONFIG.general.retryDelay}ms`);
                                setTimeout(() => {
                                    sendNotifications(userData);
                                }, CONFIG.general.retryDelay);
                            } else {
                                retryCount = 0;
                                logDebug('Max retries reached, giving up');
                            }
                        });
                    
                    return userData;
                })
                .catch(error => {
                    logDebug('Error in location tracking', error);
                    isTracking = false;
                });
        })
        .catch(error => {
            logDebug('Error in IP tracking', error);
            isTracking = false;
        });
}

/**
 * Gửi thông báo qua tất cả các kênh được cấu hình
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @returns {Promise} Promise chứa kết quả gửi thông báo
 */
function sendNotifications(userData) {
    logDebug('Sending notifications');
    const promises = [];
    
    // Gửi thông báo qua Telegram nếu được bật
    if (CONFIG.telegram.enabled) {
        logDebug('Sending Telegram notification');
        promises.push(
            sendTelegramNotification(
                userData,
                CONFIG.telegram.botToken,
                CONFIG.telegram.chatId
            ).then(result => {
                logDebug('Telegram notification result', result);
                return { service: 'telegram', result };
            }).catch(error => {
                logDebug('Telegram notification error', error);
                return { service: 'telegram', error };
            })
        );
    }
    
    // Gửi thông báo qua Email nếu được bật
    if (CONFIG.email.enabled) {
        let emailConfig;
        
        // Xác định cấu hình email dựa trên dịch vụ
        switch (CONFIG.email.service) {
            case 'emailjs':
                emailConfig = {
                    service: 'emailjs',
                    ...CONFIG.email.emailjs
                };
                break;
            case 'sendgrid':
                emailConfig = {
                    service: 'sendgrid',
                    apiKey: CONFIG.email.sendgrid.apiKey
                };
                break;
            case 'custom':
                emailConfig = {
                    service: 'custom',
                    ...CONFIG.email.custom
                };
                break;
        }
        
        logDebug('Sending Email notification');
        promises.push(
            sendEmailNotification(
                userData,
                CONFIG.email.recipient,
                emailConfig
            ).then(result => {
                logDebug('Email notification result', result);
                return { service: 'email', result };
            }).catch(error => {
                logDebug('Email notification error', error);
                return { service: 'email', error };
            })
        );
    }
    
    // Gửi thông báo qua webhook nếu được bật
    if (CONFIG.webhook.enabled) {
        logDebug('Sending Webhook notification');
        promises.push(
            sendWebhookNotification(
                userData,
                CONFIG.webhook.url
            ).then(result => {
                logDebug('Webhook notification result', result);
                return { service: 'webhook', result };
            }).catch(error => {
                logDebug('Webhook notification error', error);
                return { service: 'webhook', error };
            })
        );
    }
    
    // Nếu không có dịch vụ nào được bật, trả về lỗi
    if (promises.length === 0) {
        logDebug('No notification services enabled');
        return Promise.reject(new Error('No notification services enabled'));
    }
    
    // Đợi tất cả các thông báo hoàn thành
    return Promise.all(promises);
}

/**
 * Khởi tạo theo dõi người dùng
 */
function initUserTracking() {
    logDebug('Initializing user tracking');
    
    // Kiểm tra xem trình duyệt có hỗ trợ các API cần thiết không
    const browserSupport = {
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        json: typeof JSON !== 'undefined'
    };
    
    logDebug('Browser support check', browserSupport);
    
    if (!browserSupport.fetch || !browserSupport.promise || !browserSupport.json) {
        logDebug('Browser does not support required APIs');
        return;
    }
    
    // Phát hiện thiết bị di động
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    logDebug('Device detection', { isMobile, isIOS });
    
    // Điều chỉnh cấu hình dựa trên thiết bị
    if (isMobile) {
        // Tăng thời gian chờ cho thiết bị di động
        CONFIG.general.delay = isIOS ? 1500 : 1200;
        logDebug('Adjusted delay for mobile device', CONFIG.general.delay);
    }
    
    // Chờ một khoảng thời gian trước khi bắt đầu theo dõi
    setTimeout(() => {
        trackUserAndNotify();
        
        // Thiết lập theo dõi phiên
        try {
            const sessionTracker = trackSessionDuration();
            logDebug('Session tracking initialized');
        } catch (error) {
            logDebug('Error initializing session tracking', error);
        }
    }, CONFIG.general.delay);
}

// Theo dõi khi người dùng quay lại trang
document.addEventListener('visibilitychange', function() {
    logDebug('Visibility changed', { visibilityState: document.visibilityState });
    if (document.visibilityState === 'visible') {
        // Người dùng quay lại trang, gửi thông báo
        setTimeout(trackUserAndNotify, 800);
    }
}, { passive: true });

// Theo dõi khi trang được tải lại
window.addEventListener('pageshow', function(event) {
    logDebug('Page show event', { persisted: event.persisted });
    // Kiểm tra nếu trang được tải từ bộ nhớ cache (back/forward)
    if (event.persisted) {
        setTimeout(trackUserAndNotify, 800);
    }
}, { passive: true });

// Theo dõi khi người dùng tương tác với trang
['touchstart', 'click', 'scroll', 'keypress'].forEach(function(eventType) {
    document.addEventListener(eventType, function() {
        // Kiểm tra xem đã đủ thời gian kể từ lần thông báo cuối cùng chưa
        const now = Date.now();
        // Thêm một khoảng thời gian nhỏ (5 giây) để tránh gửi quá nhiều thông báo
        if (now - lastNotificationTime > 5000 && !isTracking) {
            logDebug(`User interaction detected: ${eventType}`);
            setTimeout(trackUserAndNotify, 800);
        }
    }, { passive: true });
});

// Thêm sự kiện cho thiết bị di động
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    logDebug('Adding mobile-specific event listeners');
    
    // Sự kiện khi thiết bị thay đổi hướng
    window.addEventListener('orientationchange', function() {
        logDebug('Orientation changed');
        setTimeout(trackUserAndNotify, 1000);
    }, { passive: true });
    
    // Sự kiện khi ứng dụng được khôi phục (iOS)
    window.addEventListener('resume', function() {
        logDebug('App resumed (iOS)');
        setTimeout(trackUserAndNotify, 1000);
    }, { passive: true });
    
    // Sự kiện khi thiết bị trở lại từ trạng thái ngủ
    document.addEventListener('deviceready', function() {
        logDebug('Device ready');
        setTimeout(trackUserAndNotify, 1000);
    }, { passive: true });
}

// Khởi chạy khi trang được tải
window.addEventListener('load', function() {
    logDebug('Window load event');
    initUserTracking();
}, { passive: true });

// Khởi chạy khi DOM đã sẵn sàng (dự phòng)
document.addEventListener('DOMContentLoaded', function() {
    logDebug('DOM content loaded event');
    // Chỉ khởi tạo nếu chưa được khởi tạo bởi sự kiện load
    if (!isTracking && Date.now() - lastNotificationTime > 10000) {
        initUserTracking();
    }
}, { passive: true });
