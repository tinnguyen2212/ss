// server.js - Simple webhook server for tracking notifications
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuration
const CONFIG = {
  telegram: {
    enabled: true,
    botToken: '7625258398:AAHhBpc6wYwQNUmxATLMxBvTaAdYh_9sZ6k', // Replace with your Telegram bot token
    chatId: '@mybotchannelss'      // Replace with your chat ID
  },
  email: {
    enabled: false,
    // Add email configuration if needed
  }
};

// Tracking pixel route
app.get('/pixel.gif', (req, res) => {
  // Create a 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  
  // Set headers
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', pixel.length);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Collect data from query parameters
  const data = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
    query: req.query
  };
  
  // Send notification asynchronously
  sendNotification(data)
    .then(result => console.log('Notification sent:', result))
    .catch(error => console.error('Error sending notification:', error));
  
  // Return the pixel immediately
  res.end(pixel);
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    
    // Add IP and headers if not included in the data
    if (!data.ip) {
      data.ip = req.ip || req.connection.remoteAddress;
    }
    
    if (!data.headers) {
      data.headers = {
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer']
      };
    }
    
    // Add timestamp if not included
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }
    
    // Send notification
    const result = await sendNotification(data);
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      result: result
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Return error
    res.status(500).json({
      success: false,
      message: 'Error sending notification',
      error: error.message
    });
  }
});

// Function to send notification
async function sendNotification(data) {
  const results = [];
  
  // Send Telegram notification if enabled
  if (CONFIG.telegram.enabled) {
    try {
      const telegramResult = await sendTelegramNotification(data);
      results.push({ service: 'telegram', result: telegramResult });
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      results.push({ service: 'telegram', error: error.message });
    }
  }
  
  // Send email notification if enabled
  if (CONFIG.email.enabled) {
    try {
      const emailResult = await sendEmailNotification(data);
      results.push({ service: 'email', result: emailResult });
    } catch (error) {
      console.error('Error sending email notification:', error);
      results.push({ service: 'email', error: error.message });
    }
  }
  
  return results;
}

// Function to send Telegram notification
async function sendTelegramNotification(data) {
  const { botToken, chatId } = CONFIG.telegram;
  
  // Format message
  const message = formatTelegramMessage(data);
  
  // Send message
  const response = await axios.post(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    }
  );
  
  return response.data;
}

// Function to format Telegram message
function formatTelegramMessage(data) {
  let message = `<b>🔔 Thông báo truy cập lịch âm dương</b>\n\n`;
  
  // Add timestamp
  message += `<b>⏰ Thời gian:</b> ${new Date(data.timestamp).toLocaleString()}\n\n`;
  
  // Add device info if available
  if (data.deviceInfo) {
    message += `<b>📱 Thiết bị:</b>\n`;
    if (data.deviceInfo.browser) message += `- Trình duyệt: ${data.deviceInfo.browser} ${data.deviceInfo.browserVersion || ''}\n`;
    if (data.deviceInfo.os) message += `- Hệ điều hành: ${data.deviceInfo.os} ${data.deviceInfo.osVersion || ''}\n`;
    if (data.deviceInfo.device) message += `- Thiết bị: ${data.deviceInfo.device}\n`;
    if (data.deviceInfo.screen) message += `- Màn hình: ${data.deviceInfo.screen}\n`;
    message += `\n`;
  } else if (data.headers && data.headers.userAgent) {
    message += `<b>📱 User-Agent:</b> ${data.headers.userAgent}\n\n`;
  }
  
  // Add IP info if available
  if (data.ipInfo) {
    message += `<b>🌐 Thông tin IP:</b>\n`;
    if (data.ipInfo.ip) message += `- IP: ${data.ipInfo.ip}\n`;
    if (data.ipInfo.country) message += `- Quốc gia: ${data.ipInfo.country}\n`;
    if (data.ipInfo.city) message += `- Thành phố: ${data.ipInfo.city}\n`;
    message += `\n`;
  } else if (data.ip) {
    message += `<b>🌐 IP:</b> ${data.ip}\n\n`;
  }
  
  // Add location info if available
  if (data.locationInfo && data.locationInfo.geoLocation) {
    const geo = data.locationInfo.geoLocation;
    message += `<b>📍 Vị trí:</b>\n`;
    if (geo.address) {
      message += `- Địa chỉ: ${geo.address}\n`;
    } else {
      if (geo.city) message += `- Thành phố: ${geo.city}\n`;
      if (geo.region) message += `- Vùng: ${geo.region}\n`;
      if (geo.country) message += `- Quốc gia: ${geo.country}\n`;
    }
    if (geo.latitude && geo.longitude) {
      message += `- Tọa độ: ${geo.latitude}, ${geo.longitude}\n`;
    }
    message += `\n`;
  }
  
  // Add page info if available
  if (data.pageInfo) {
    message += `<b>🔗 Thông tin trang:</b>\n`;
    if (data.pageInfo.url) message += `- URL: ${data.pageInfo.url}\n`;
    if (data.pageInfo.title) message += `- Tiêu đề: ${data.pageInfo.title}\n`;
    if (data.pageInfo.referrer) message += `- Nguồn: ${data.pageInfo.referrer}\n`;
    message += `\n`;
  } else if (data.headers && data.headers.referer) {
    message += `<b>🔗 Referer:</b> ${data.headers.referer}\n\n`;
  }
  
  // Add query parameters if available
  if (data.query && Object.keys(data.query).length > 0) {
    message += `<b>❓ Query Parameters:</b>\n`;
    for (const [key, value] of Object.entries(data.query)) {
      message += `- ${key}: ${value}\n`;
    }
    message += `\n`;
  }
  
  return message;
}

// Function to send email notification (placeholder)
async function sendEmailNotification(data) {
  // Implement email sending logic here
  return { success: true, message: 'Email notification sent' };
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
