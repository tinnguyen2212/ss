/**
 * Mã tích hợp chức năng theo dõi người dùng cho lịch âm dương
 * Thu thập thông tin thiết bị, IP, vị trí, thời gian truy cập và gửi thông báo
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
        recipient: 'cgart.tinnguyen@gmail.com', // Thay thế bằng email của bạn
        
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
    
    // Cấu hình chung
    general: {
        // Thời gian chờ trước khi thu thập dữ liệu (ms)
        delay: 2000,
        
        // Chỉ gửi thông báo một lần mỗi phiên
        notifyOncePerSession: true,
        
        // Thời gian tối thiểu giữa các thông báo (ms)
        minTimeBetweenNotifications: 3600000 // 1 giờ
    }
};

// Biến toàn cục để theo dõi trạng thái
let lastNotificationTime = 0;
let notificationSent = false;

/**
 * Hàm chính để thu thập và gửi dữ liệu người dùng
 */
function trackUserAndNotify() {
    // Kiểm tra xem đã gửi thông báo trong phiên này chưa
    if (CONFIG.general.notifyOncePerSession && notificationSent) {
        console.log('Notification already sent in this session');
        return;
    }
    
    // Kiểm tra thời gian giữa các thông báo
    const now = Date.now();
    if (now - lastNotificationTime < CONFIG.general.minTimeBetweenNotifications) {
        console.log('Too soon for another notification');
        return;
    }
    
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
                    
                    // Cập nhật trạng thái
                    lastNotificationTime = now;
                    notificationSent = true;
                    
                    // Lưu trạng thái vào localStorage để tránh gửi thông báo quá nhiều
                    try {
                        localStorage.setItem('lastNotificationTime', lastNotificationTime);
                    } catch (e) {
                        console.error('Error saving to localStorage:', e);
                    }
                    
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
    // Khôi phục trạng thái từ localStorage
    try {
        const savedTime = localStorage.getItem('lastNotificationTime');
        if (savedTime) {
            lastNotificationTime = parseInt(savedTime, 10);
        }
    } catch (e) {
        console.error('Error reading from localStorage:', e);
    }
    
    // Chờ một khoảng thời gian trước khi bắt đầu theo dõi
    setTimeout(() => {
        trackUserAndNotify();
        
        // Thiết lập theo dõi phiên
        const sessionTracker = trackSessionDuration();
    }, CONFIG.general.delay);
}

// Khởi chạy khi trang được tải
window.addEventListener('load', initUserTracking);
