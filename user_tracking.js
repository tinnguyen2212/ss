/**
 * Mã tích hợp chức năng theo dõi người dùng cho lịch âm dương
 * Thu thập thông tin thiết bị, IP, vị trí, thời gian truy cập và gửi thông báo
 * Phiên bản: Realtime - Thông báo mỗi khi có người truy cập
 * Cập nhật: Không hiển thị thông báo xin quyền vị trí
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
    
    // Cấu hình chung - Đã điều chỉnh cho realtime
    general: {
        // Thời gian chờ trước khi thu thập dữ liệu (ms) - giảm xuống để phản hồi nhanh hơn
        delay: 500,
        
        // Luôn gửi thông báo mỗi khi có người truy cập
        notifyOncePerSession: false,
        
        // Không có thời gian chờ giữa các thông báo
        minTimeBetweenNotifications: 0
    }
};

// Biến toàn cục để theo dõi trạng thái
let lastNotificationTime = 0;

/**
 * Hàm thu thập thông tin vị trí của người dùng (chỉ dựa trên IP)
 * Phiên bản cập nhật: Không sử dụng Geolocation API để tránh hiển thị thông báo xin quyền
 * @returns {Promise} Promise chứa thông tin vị trí
 */
function getLocationInfo() {
    return getIPBasedLocation()
        .then(locationData => {
            return {
                geoLocation: locationData,
                networkInfo: getNetworkInfo(),
                timestamp: new Date().toISOString()
            };
        })
        .catch(error => {
            console.error('Error collecting location information:', error);
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
        return Promise.resolve({
            source: 'Failed',
            error: 'All location services failed',
            timestamp: new Date().toISOString()
        });
    }
    
    const service = services[index];
    
    return fetch(service.url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`${service.name} responded with ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            return processLocationData(data, service.name);
        })
        .catch(error => {
            console.warn(`Error with ${service.name}:`, error);
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
    // Thu thập thông tin thiết bị
    const deviceInfo = getDeviceInfo();
    
    // Thu thập thông tin IP
    getIPAddress()
        .then(ipInfo => {
            // Thu thập thông tin vị trí (chỉ dựa trên IP, không yêu cầu quyền)
            return getLocationInfo()
                .then(locationInfo => {
                    // Thu thập thông tin thời gian truy cập
                    const accessTime = getAccessTime();
                    
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
                        }
                    };
                    
                    // Gửi thông báo với dữ liệu đã thu thập
                    sendNotifications(userData);
                    
                    // Cập nhật thời gian thông báo cuối cùng
                    lastNotificationTime = Date.now();
                    
                    return userData;
                });
        })
        .catch(error => {
            console.error('Error in tracking process:', error);
        });
}

/**
 * Gửi thông báo qua tất cả các kênh được cấu hình
 * @param {Object} userData - Dữ liệu người dùng đã thu thập
 */
function sendNotifications(userData) {
    // Gửi thông báo qua Telegram nếu được bật
    if (CONFIG.telegram.enabled) {
        sendTelegramNotification(
            userData,
            CONFIG.telegram.botToken,
            CONFIG.telegram.chatId
        ).then(result => {
            console.log('Telegram notification result:', result);
        });
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
        
        sendEmailNotification(
            userData,
            CONFIG.email.recipient,
            emailConfig
        ).then(result => {
            console.log('Email notification result:', result);
        });
    }
    
    // Gửi thông báo qua webhook nếu được bật
    if (CONFIG.webhook.enabled) {
        sendWebhookNotification(
            userData,
            CONFIG.webhook.url
        ).then(result => {
            console.log('Webhook notification result:', result);
        });
    }
}

/**
 * Khởi tạo theo dõi người dùng
 */
function initUserTracking() {
    // Chờ một khoảng thời gian ngắn trước khi bắt đầu theo dõi
    setTimeout(() => {
        trackUserAndNotify();
        
        // Thiết lập theo dõi phiên
        const sessionTracker = trackSessionDuration();
    }, CONFIG.general.delay);
}

// Theo dõi khi người dùng quay lại trang
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        // Người dùng quay lại trang, gửi thông báo
        setTimeout(trackUserAndNotify, 500);
    }
});

// Theo dõi khi trang được tải lại
window.addEventListener('pageshow', function(event) {
    // Kiểm tra nếu trang được tải từ bộ nhớ cache (back/forward)
    if (event.persisted) {
        setTimeout(trackUserAndNotify, 500);
    }
});

// Theo dõi khi người dùng tương tác với trang
['click', 'scroll', 'keypress'].forEach(function(event) {
    document.addEventListener(event, function() {
        // Kiểm tra xem đã đủ thời gian kể từ lần thông báo cuối cùng chưa
        const now = Date.now();
        // Thêm một khoảng thời gian nhỏ (5 giây) để tránh gửi quá nhiều thông báo
        if (now - lastNotificationTime > 5000) {
            setTimeout(trackUserAndNotify, 500);
        }
    }, { passive: true });
});

// Khởi chạy khi trang được tải
window.addEventListener('load', initUserTracking);
