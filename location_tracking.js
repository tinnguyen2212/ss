/**
 * Hàm thu thập thông tin vị trí của người dùng
 * @returns {Promise} Promise chứa thông tin vị trí
 */
function getLocation() {
    return new Promise((resolve, reject) => {
        // Kiểm tra xem trình duyệt có hỗ trợ Geolocation API không
        if (navigator.geolocation) {
            // Thiết lập các tùy chọn cho việc lấy vị trí
            const options = {
                enableHighAccuracy: true, // Yêu cầu độ chính xác cao nhất có thể
                timeout: 5000,           // Thời gian chờ tối đa (ms)
                maximumAge: 0            // Không sử dụng dữ liệu vị trí đã lưu trong bộ nhớ cache
            };

            // Yêu cầu vị trí hiện tại
            navigator.geolocation.getCurrentPosition(
                // Callback khi thành công
                (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp,
                        source: 'Geolocation API'
                    };
                    
                    // Thử lấy thêm thông tin địa chỉ dựa trên tọa độ (reverse geocoding)
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=18&addressdetails=1`)
                        .then(response => response.json())
                        .then(data => {
                            locationData.address = data.display_name;
                            locationData.addressDetails = data.address;
                            resolve(locationData);
                        })
                        .catch(error => {
                            // Nếu không lấy được thông tin địa chỉ, vẫn trả về dữ liệu vị trí
                            console.error('Error fetching address details:', error);
                            resolve(locationData);
                        });
                },
                // Callback khi có lỗi
                (error) => {
                    console.error('Geolocation error:', error);
                    
                    // Nếu người dùng từ chối cấp quyền hoặc có lỗi khác, thử phương pháp dự phòng
                    // Sử dụng IP để ước tính vị trí
                    fallbackToIPLocation()
                        .then(locationData => resolve(locationData))
                        .catch(fallbackError => {
                            console.error('IP location fallback failed:', fallbackError);
                            resolve({ error: 'Location unavailable', errorCode: error.code, source: 'Failed' });
                        });
                },
                // Tùy chọn
                options
            );
        } else {
            // Trình duyệt không hỗ trợ Geolocation
            console.error('Geolocation is not supported by this browser');
            
            // Thử phương pháp dự phòng
            fallbackToIPLocation()
                .then(locationData => resolve(locationData))
                .catch(fallbackError => {
                    console.error('IP location fallback failed:', fallbackError);
                    resolve({ error: 'Geolocation not supported', source: 'Failed' });
                });
        }
    });
}

/**
 * Phương pháp dự phòng để lấy vị trí dựa trên IP
 * @returns {Promise} Promise chứa thông tin vị trí dựa trên IP
 */
function fallbackToIPLocation() {
    // Sử dụng ipinfo.io để lấy vị trí dựa trên IP
    return fetch('https://ipinfo.io/json')
        .then(response => response.json())
        .then(data => {
            // Phân tích tọa độ từ chuỗi "lat,lon"
            let latitude = null;
            let longitude = null;
            
            if (data.loc && data.loc.includes(',')) {
                const [lat, lon] = data.loc.split(',');
                latitude = parseFloat(lat);
                longitude = parseFloat(lon);
            }
            
            return {
                ip: data.ip,
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country || 'Unknown',
                latitude: latitude,
                longitude: longitude,
                postal: data.postal,
                timezone: data.timezone,
                org: data.org,
                source: 'IP-based location'
            };
        });
}

/**
 * Hàm lấy thông tin mạng WiFi (nếu có thể)
 * @returns {Promise} Promise chứa thông tin mạng WiFi
 */
function getWiFiInfo() {
    return new Promise((resolve) => {
        // Kiểm tra xem trình duyệt có hỗ trợ Network Information API không
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;
        
        if (connection) {
            const networkInfo = {
                type: connection.type || 'Unknown',
                effectiveType: connection.effectiveType || 'Unknown',
                downlinkMax: connection.downlinkMax || 'Unknown',
                downlink: connection.downlink || 'Unknown',
                rtt: connection.rtt || 'Unknown',
                saveData: connection.saveData || false
            };
            
            resolve(networkInfo);
        } else {
            // Nếu API không được hỗ trợ, trả về thông tin giới hạn
            resolve({ 
                supported: false,
                message: 'Network Information API not supported by this browser'
            });
        }
    });
}

/**
 * Hàm tổng hợp thu thập thông tin vị trí đầy đủ
 * @returns {Promise} Promise chứa tất cả thông tin vị trí
 */
function getLocationInfo() {
    return Promise.all([getLocation(), getWiFiInfo()])
        .then(([locationData, wifiData]) => {
            return {
                geoLocation: locationData,
                networkInfo: wifiData,
                timestamp: new Date().toISOString()
            };
        })
        .catch(error => {
            console.error('Error collecting location information:', error);
            return {
                error: 'Failed to collect location information',
                errorDetails: error.message,
                timestamp: new Date().toISOString()
            };
        });
}
