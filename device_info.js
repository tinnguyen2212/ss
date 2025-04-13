/**
 * Hàm thu thập thông tin thiết bị người dùng
 * @returns {Object} Thông tin về thiết bị người dùng
 */
function getDeviceInfo() {
    const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency || 'N/A',
        deviceMemory: navigator.deviceMemory || 'N/A',
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        screenColorDepth: window.screen.colorDepth,
        screenPixelDepth: window.screen.pixelDepth,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        touchPoints: navigator.maxTouchPoints || 'N/A',
        connection: getConnectionInfo(),
        browser: getBrowserInfo(),
        os: getOSInfo(),
        device: getDeviceType()
    };
    
    return deviceInfo;
}

/**
 * Lấy thông tin về kết nối mạng
 * @returns {Object} Thông tin kết nối mạng
 */
function getConnectionInfo() {
    const connection = navigator.connection || 
                      navigator.mozConnection || 
                      navigator.webkitConnection;
    
    if (connection) {
        return {
            effectiveType: connection.effectiveType || 'N/A',
            downlink: connection.downlink || 'N/A',
            rtt: connection.rtt || 'N/A',
            saveData: connection.saveData || false
        };
    }
    
    return 'N/A';
}

/**
 * Phân tích thông tin trình duyệt từ userAgent
 * @returns {Object} Thông tin trình duyệt
 */
function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    
    // Chrome
    if (/Chrome/.test(ua) && !/Chromium|Edge|Edg|OPR|Opera/.test(ua)) {
        browserName = 'Chrome';
        browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)[1];
    }
    // Firefox
    else if (/Firefox/.test(ua)) {
        browserName = 'Firefox';
        browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)[1];
    }
    // Safari
    else if (/Safari/.test(ua) && !/Chrome|Chromium|Edge|Edg|OPR|Opera/.test(ua)) {
        browserName = 'Safari';
        browserVersion = ua.match(/Version\/(\d+\.\d+)/)[1];
    }
    // Edge (Chromium based)
    else if (/Edg/.test(ua)) {
        browserName = 'Edge';
        browserVersion = ua.match(/Edg\/(\d+\.\d+)/)[1];
    }
    // Edge (Legacy)
    else if (/Edge/.test(ua)) {
        browserName = 'Edge (Legacy)';
        browserVersion = ua.match(/Edge\/(\d+\.\d+)/)[1];
    }
    // Opera
    else if (/OPR|Opera/.test(ua)) {
        browserName = 'Opera';
        browserVersion = ua.match(/(?:OPR|Opera)\/(\d+\.\d+)/)[1];
    }
    // IE
    else if (/MSIE|Trident/.test(ua)) {
        browserName = 'Internet Explorer';
        browserVersion = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/)[1];
    }
    
    return {
        name: browserName,
        version: browserVersion
    };
}

/**
 * Phân tích thông tin hệ điều hành từ userAgent
 * @returns {Object} Thông tin hệ điều hành
 */
function getOSInfo() {
    const ua = navigator.userAgent;
    let osName = 'Unknown';
    let osVersion = 'Unknown';
    
    // Windows
    if (/Windows/.test(ua)) {
        osName = 'Windows';
        if (/Windows NT 10.0/.test(ua)) osVersion = '10';
        else if (/Windows NT 6.3/.test(ua)) osVersion = '8.1';
        else if (/Windows NT 6.2/.test(ua)) osVersion = '8';
        else if (/Windows NT 6.1/.test(ua)) osVersion = '7';
        else if (/Windows NT 6.0/.test(ua)) osVersion = 'Vista';
        else if (/Windows NT 5.1/.test(ua)) osVersion = 'XP';
        else if (/Windows NT 5.0/.test(ua)) osVersion = '2000';
    }
    // macOS
    else if (/Macintosh|Mac OS X/.test(ua)) {
        osName = 'macOS';
        const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
        if (match) {
            osVersion = match[1].replace(/_/g, '.');
        }
    }
    // iOS
    else if (/iPhone|iPad|iPod/.test(ua)) {
        osName = 'iOS';
        const match = ua.match(/OS (\d+[._]\d+[._]?\d*)/);
        if (match) {
            osVersion = match[1].replace(/_/g, '.');
        }
    }
    // Android
    else if (/Android/.test(ua)) {
        osName = 'Android';
        const match = ua.match(/Android (\d+(?:\.\d+)+)/);
        if (match) {
            osVersion = match[1];
        }
    }
    // Linux
    else if (/Linux/.test(ua)) {
        osName = 'Linux';
    }
    
    return {
        name: osName,
        version: osVersion
    };
}

/**
 * Xác định loại thiết bị dựa trên userAgent
 * @returns {String} Loại thiết bị
 */
function getDeviceType() {
    const ua = navigator.userAgent;
    
    if (/iPad/.test(ua)) {
        return 'iPad';
    } else if (/iPhone/.test(ua)) {
        return 'iPhone';
    } else if (/Android/.test(ua) && /Mobile/.test(ua)) {
        return 'Android Phone';
    } else if (/Android/.test(ua)) {
        return 'Android Tablet';
    } else if (/Windows Phone/.test(ua)) {
        return 'Windows Phone';
    } else if (/Windows/.test(ua) && /Touch/.test(ua)) {
        return 'Windows Tablet';
    } else if (/Macintosh|Mac OS X/.test(ua) && navigator.maxTouchPoints > 0) {
        return 'iPad with macOS UA';
    } else if (/Macintosh|Mac OS X/.test(ua)) {
        return 'Mac';
    } else if (/Windows/.test(ua)) {
        return 'Windows PC';
    } else if (/Linux/.test(ua)) {
        return 'Linux PC';
    }
    
    return 'Unknown Device';
}
