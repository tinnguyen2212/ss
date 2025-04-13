/**
 * Hàm ghi nhận thời gian truy cập của người dùng
 * @returns {Object} Thông tin về thời gian truy cập
 */
function getAccessTime() {
    const now = new Date();
    
    // Lấy thông tin múi giờ của người dùng
    const timeZoneOffset = now.getTimezoneOffset();
    const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    
    // Tính toán múi giờ dưới dạng +/-HH:MM
    const offsetHours = Math.abs(Math.floor(timeZoneOffset / 60));
    const offsetMinutes = Math.abs(timeZoneOffset % 60);
    const offsetSign = timeZoneOffset > 0 ? '-' : '+';
    const formattedOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
    
    // Định dạng thời gian theo nhiều chuẩn
    const accessTimeInfo = {
        timestamp: now.getTime(),
        iso8601: now.toISOString(),
        utc: now.toUTCString(),
        local: now.toString(),
        localeDateString: now.toLocaleDateString(),
        localeTimeString: now.toLocaleTimeString(),
        timeZoneOffset: formattedOffset,
        timeZoneName: timeZoneName,
        
        // Thông tin chi tiết
        year: now.getFullYear(),
        month: now.getMonth() + 1, // getMonth() trả về 0-11
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds(),
        
        // Thông tin bổ sung
        dayOfWeek: now.getDay(), // 0 = Chủ Nhật, 1-6 = Thứ Hai - Thứ Bảy
        dayOfWeekName: getDayOfWeekName(now.getDay()),
        monthName: getMonthName(now.getMonth()),
        
        // Thời gian truy cập tính từ epoch (1/1/1970)
        secondsSinceEpoch: Math.floor(now.getTime() / 1000),
        
        // Thời gian trang được tải
        pageLoadTime: getPageLoadTime()
    };
    
    return accessTimeInfo;
}

/**
 * Lấy tên của ngày trong tuần
 * @param {Number} dayIndex - Chỉ số ngày (0-6)
 * @returns {String} Tên ngày trong tuần
 */
function getDayOfWeekName(dayIndex) {
    const days = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 
        'Thursday', 'Friday', 'Saturday'
    ];
    return days[dayIndex] || 'Unknown';
}

/**
 * Lấy tên tháng
 * @param {Number} monthIndex - Chỉ số tháng (0-11)
 * @returns {String} Tên tháng
 */
function getMonthName(monthIndex) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex] || 'Unknown';
}

/**
 * Lấy thời gian tải trang
 * @returns {Object} Thông tin về thời gian tải trang
 */
function getPageLoadTime() {
    // Kiểm tra xem Performance API có được hỗ trợ không
    if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        
        // Tính toán các mốc thời gian quan trọng
        const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        const domReadyTime = timing.domComplete - timing.domLoading;
        const fetchTime = timing.responseEnd - timing.fetchStart;
        const dnsTime = timing.domainLookupEnd - timing.domainLookupStart;
        const tcpTime = timing.connectEnd - timing.connectStart;
        const serverResponseTime = timing.responseEnd - timing.requestStart;
        
        return {
            pageLoadTime: pageLoadTime,
            domReadyTime: domReadyTime,
            fetchTime: fetchTime,
            dnsTime: dnsTime,
            tcpTime: tcpTime,
            serverResponseTime: serverResponseTime,
            navigationStart: timing.navigationStart,
            unloadEventStart: timing.unloadEventStart,
            unloadEventEnd: timing.unloadEventEnd,
            redirectStart: timing.redirectStart,
            redirectEnd: timing.redirectEnd,
            fetchStart: timing.fetchStart,
            domainLookupStart: timing.domainLookupStart,
            domainLookupEnd: timing.domainLookupEnd,
            connectStart: timing.connectStart,
            connectEnd: timing.connectEnd,
            secureConnectionStart: timing.secureConnectionStart,
            requestStart: timing.requestStart,
            responseStart: timing.responseStart,
            responseEnd: timing.responseEnd,
            domLoading: timing.domLoading,
            domInteractive: timing.domInteractive,
            domContentLoadedEventStart: timing.domContentLoadedEventStart,
            domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
            domComplete: timing.domComplete,
            loadEventStart: timing.loadEventStart,
            loadEventEnd: timing.loadEventEnd
        };
    }
    
    // Nếu Performance API không được hỗ trợ
    return {
        supported: false,
        message: 'Performance API not supported by this browser'
    };
}

/**
 * Theo dõi thời gian người dùng ở lại trang
 * @returns {Object} Đối tượng theo dõi thời gian
 */
function trackSessionDuration() {
    const startTime = new Date();
    let lastActiveTime = startTime;
    let isActive = true;
    
    // Theo dõi khi người dùng rời khỏi trang
    window.addEventListener('beforeunload', function() {
        const endTime = new Date();
        const duration = endTime - startTime;
        const activeDuration = isActive ? (endTime - lastActiveTime) : 0;
        
        // Có thể gửi dữ liệu này trước khi người dùng rời đi
        // Lưu ý: Nhiều trình duyệt hiện đại hạn chế các hoạt động trong sự kiện beforeunload
        try {
            const sessionData = {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                durationMs: duration,
                durationFormatted: formatDuration(duration),
                isActive: isActive,
                activeDurationMs: activeDuration,
                activeDurationFormatted: formatDuration(activeDuration)
            };
            
            // Lưu vào localStorage để có thể truy xuất sau này
            localStorage.setItem('lastSessionData', JSON.stringify(sessionData));
            
            // Có thể gửi dữ liệu qua beacon API (không bị chặn bởi beforeunload)
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
                navigator.sendBeacon('/api/track-session', blob);
            }
            
            return sessionData;
        } catch (e) {
            console.error('Error tracking session duration:', e);
        }
    });
    
    // Theo dõi khi người dùng chuyển tab hoặc cửa sổ
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
            isActive = false;
        } else {
            isActive = true;
            lastActiveTime = new Date();
        }
    });
    
    // Theo dõi hoạt động của người dùng
    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(function(event) {
        document.addEventListener(event, function() {
            isActive = true;
            lastActiveTime = new Date();
        }, { passive: true });
    });
    
    return {
        getSessionDuration: function() {
            const currentTime = new Date();
            const duration = currentTime - startTime;
            return {
                startTime: startTime.toISOString(),
                currentTime: currentTime.toISOString(),
                durationMs: duration,
                durationFormatted: formatDuration(duration),
                isActive: isActive
            };
        }
    };
}

/**
 * Định dạng thời gian từ milliseconds sang chuỗi dễ đọc
 * @param {Number} duration - Thời gian tính bằng milliseconds
 * @returns {String} Chuỗi thời gian định dạng
 */
function formatDuration(duration) {
    const seconds = Math.floor(duration / 1000) % 60;
    const minutes = Math.floor(duration / (1000 * 60)) % 60;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
