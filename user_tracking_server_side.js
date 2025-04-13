/**
 * Mã tích hợp chức năng theo dõi người dùng cho lịch âm dương
 * Thu thập thông tin thiết bị, IP, vị trí, thời gian truy cập và gửi thông báo
 * Phiên bản: Server-Side - Sử dụng webhook để gửi thông báo từ máy chủ
 */

// Cấu hình theo dõi - Thay đổi thông tin này theo nhu cầu của bạn
const CONFIG = {
    // Cấu hình webhook server
    server: {
        // URL của webhook server của bạn
        webhookUrl: 'https://gelatinous-eastern-button.glitch.me//webhook',
        
        // URL của tracking pixel
        pixelUrl: 'https://gelatinous-eastern-button.glitch.me//pixel.gif',
        
        // Sử dụng cả webhook và tracking pixel để đảm bảo hoạt động trên mọi thiết bị
        useWebhook: true,
        usePixel: true
    },
    
    // Cấu hình chung
    general: {
        // Thời gian chờ trước khi thu thập dữ liệu (ms)
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
let trackingAttempts = 0;

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
        
        // Lưu log vào localStorage nếu được hỗ trợ
        try {
            localStorage.setItem('trackingDebugLog', JSON.stringify(debugLog.slice(-20)));
        } catch (e) {
            // Bỏ qua lỗi nếu localStorage không được hỗ trợ
        }
    }
}

/**
 * Phát hiện trình duyệt và thiết bị
 * @returns {Object} Thông tin về trình duyệt và thiết bị
 */
function detectBrowserAndDevice() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const vendor = navigator.vendor || '';
    
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid;
    
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua);
    const isChrome = /Chrome|Chromium/i.test(ua) && !/Edge|Edg|OPR|Opera/i.test(ua);
    const isFirefox = /Firefox/i.test(ua);
    const isEdge = /Edge|Edg/i.test(ua);
    
    // Chrome trên iOS thực chất là Safari với giao diện Chrome
    const isChromeIOS = isIOS && /CriOS/i.test(ua);
    
    const result = {
        ua,
        platform,
        vendor,
        isIOS,
        isAndroid,
        isMobile,
        isSafari,
        isChrome,
        isFirefox,
        isEdge,
        isChromeIOS
    };
    
    logDebug('Browser and device detection', result);
    return result;
}

/**
 * Hàm thu thập thông tin vị trí của người dùng (chỉ dựa trên IP)
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
    trackingAttempts++;
    logDebug(`Starting user tracking (attempt ${trackingAttempts})`);
    
    // Thu thập thông tin thiết bị
    let deviceInfo;
    try {
        deviceInfo = getDeviceInfo();
        logDebug('Device info collected', deviceInfo);
    } catch (error) {
        logDebug('Error collecting device info', error);
        deviceInfo = { error: 'Failed to collect device info', userAgent: navigator.userAgent };
    }
    
    // Thu thập thông tin IP và vị trí
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
                            logs: debugLog.slice(-10),
                            userAgent: navigator.userAgent,
                            platform: navigator.platform,
                            vendor: navigator.vendor,
                            trackingAttempts: trackingAttempts
                        } : null
                    };
                    
                    // Gửi thông báo với dữ liệu đã thu thập
                    sendNotificationsToServer(userData)
                        .then(result => {
                            logDebug('Notifications sent to server', result);
                            isTracking = false;
                            retryCount = 0;
                            lastNotificationTime = Date.now();
                        })
                        .catch(error => {
                            logDebug('Error sending notifications to server', error);
                            isTracking = false;
                            
                            // Thử lại nếu chưa đạt số lần thử tối đa
                            if (retryCount < CONFIG.general.maxRetries) {
                                retryCount++;
                                logDebug(`Retrying (${retryCount}/${CONFIG.general.maxRetries}) in ${CONFIG.general.retryDelay}ms`);
                                setTimeout(() => {
                                    sendNotificationsToServer(userData);
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
 * Gửi thông báo đến webhook server
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @returns {Promise} Promise chứa kết quả gửi thông báo
 */
function sendNotificationsToServer(userData) {
    logDebug('Sending notifications to server');
    const promises = [];
    
    // Sử dụng webhook nếu được bật
    if (CONFIG.server.useWebhook) {
        logDebug('Using webhook to send notification');
        promises.push(sendWebhookNotification(userData));
    }
    
    // Sử dụng tracking pixel nếu được bật
    if (CONFIG.server.usePixel) {
        logDebug('Using tracking pixel to send notification');
        promises.push(sendPixelNotification(userData));
    }
    
    // Nếu không có phương pháp nào được bật, trả về lỗi
    if (promises.length === 0) {
        logDebug('No notification methods enabled');
        return Promise.reject(new Error('No notification methods enabled'));
    }
    
    // Đợi bất kỳ phương pháp nào hoàn thành (không cần tất cả đều thành công)
    return Promise.any(promises)
        .catch(error => {
            logDebug('All notification methods failed', error);
            return Promise.reject(new Error('All notification methods failed'));
        });
}

/**
 * Gửi thông báo qua webhook
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @returns {Promise} Promise chứa kết quả gửi thông báo
 */
function sendWebhookNotification(userData) {
    return new Promise((resolve, reject) => {
        try {
            logDebug('Sending webhook notification');
            
            // Gửi dữ liệu đến webhook server
            fetch(CONFIG.server.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Webhook server responded with ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                logDebug('Webhook notification sent successfully', data);
                resolve({
                    method: 'webhook',
                    success: true,
                    data: data
                });
            })
            .catch(error => {
                logDebug('Error sending webhook notification', error);
                reject(error);
            });
        } catch (error) {
            logDebug('Exception sending webhook notification', error);
            reject(error);
        }
    });
}

/**
 * Gửi thông báo qua tracking pixel
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @returns {Promise} Promise chứa kết quả gửi thông báo
 */
function sendPixelNotification(userData) {
    return new Promise((resolve, reject) => {
        try {
            logDebug('Sending pixel notification');
            
            // Tạo URL với query parameters
            const params = new URLSearchParams();
            
            // Thêm thông tin cơ bản
            params.append('timestamp', new Date().toISOString());
            params.append('url', window.location.href);
            params.append('title', document.title);
            params.append('referrer', document.referrer);
            
            // Thêm thông tin thiết bị
            if (userData.deviceInfo) {
                if (userData.deviceInfo.browser) params.append('browser', userData.deviceInfo.browser);
                if (userData.deviceInfo.os) params.append('os', userData.deviceInfo.os);
                if (userData.deviceInfo.device) params.append('device', userData.deviceInfo.device);
            }
            
            // Thêm thông tin IP nếu có
            if (userData.ipInfo && userData.ipInfo.ip) {
                params.append('ip', userData.ipInfo.ip);
            }
            
            // Thêm thông tin vị trí nếu có
            if (userData.locationInfo && userData.locationInfo.geoLocation) {
                const geo = userData.locationInfo.geoLocation;
                if (geo.country) params.append('country', geo.country);
                if (geo.city) params.append('city', geo.city);
                if (geo.latitude && geo.longitude) {
                    params.append('lat', geo.latitude);
                    params.append('lon', geo.longitude);
                }
            }
            
            // Tạo URL đầy đủ
            const pixelUrl = `${CONFIG.server.pixelUrl}?${params.toString()}`;
            
            // Tạo một image element để gửi yêu cầu
            const img = new Image();
            
            // Xử lý khi tải thành công
            img.onload = function() {
                logDebug('Pixel notification sent successfully');
                resolve({
                    method: 'pixel',
                    success: true
                });
            };
            
            // Xử lý khi có lỗi
            img.onerror = function() {
                logDebug('Error sending pixel notification');
                reject(new Error('Error loading tracking pixel'));
            };
            
            // Gửi yêu cầu
            img.src = pixelUrl;
            
            // Đặt timeout
            setTimeout(function() {
                if (!img.complete) {
                    logDebug('Pixel request timed out');
                    img.onload = null;
                    img.onerror = null;
                    reject(new Error('Pixel request timed out'));
                }
            }, 10000);
        } catch (error) {
            logDebug('Exception sending pixel notification', error);
            reject(error);
        }
    });
}

/**
 * Khởi tạo theo dõi người dùng
 */
function initUserTracking() {
    logDebug('Initializing user tracking');
    
    // Phát hiện trình duyệt và thiết bị
    const browserInfo = detectBrowserAndDevice();
    
    // Điều chỉnh cấu hình dựa trên thiết bị
    if (browserInfo.isMobile) {
        // Tăng thời gian chờ cho thiết bị di động
        CONFIG.general.delay = browserInfo.isIOS ? 1500 : 1200;
        logDebug('Adjusted delay for mobile device', CONFIG.general.delay);
    }
    
    // Điều chỉnh cấu hình đặc biệt cho Chrome iOS
    if (browserInfo.isChromeIOS) {
        // Đảm bảo sử dụng tracking pixel cho Chrome iOS
        CONFIG.server.usePixel = true;
        logDebug('Ensured tracking pixel is enabled for Chrome iOS');
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
