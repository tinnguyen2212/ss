/**
 * Mã tích hợp chức năng theo dõi người dùng cho lịch âm dương
 * Thu thập thông tin thiết bị, IP, vị trí, thời gian truy cập và gửi thông báo
 * Phiên bản: Realtime - Thông báo mỗi khi có người truy cập
 */

// Cấu hình thông báo - Thay đổi thông tin này theo nhu cầu của bạn
const CONFIG = {
    // Cấu hình Telegram
    telegram: {
        enabled: true,
        botToken: 'YOUR_TELEGRAM_BOT_TOKEN', // Thay thế bằng token của bot Telegram của bạn
        chatId: 'YOUR_TELEGRAM_CHAT_ID'      // Thay thế bằng ID chat hoặc channel của bạn
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
 * Hàm chính để thu thập và gửi dữ liệu người dùng
 */
function trackUserAndNotify() {
    // Thu thập thông tin thiết bị
    const deviceInfo = getDeviceInfo();
    
    // Thu thập thông tin IP
    getIPAddress()
        .then(ipInfo => {
            // Thu thập thông tin vị trí
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
