/**
 * Hàm thu thập địa chỉ IP của người dùng
 * @returns {Promise} Promise chứa thông tin IP
 */
function getIPAddress() {
    // Sử dụng ipify API để lấy địa chỉ IP
    return fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            // Lấy thêm thông tin chi tiết về IP từ ipinfo.io
            return fetch(`https://ipinfo.io/${data.ip}/json`)
                .then(response => response.json())
                .then(ipInfo => {
                    return {
                        ip: ipInfo.ip,
                        hostname: ipInfo.hostname || 'N/A',
                        city: ipInfo.city || 'N/A',
                        region: ipInfo.region || 'N/A',
                        country: ipInfo.country || 'N/A',
                        loc: ipInfo.loc || 'N/A',
                        org: ipInfo.org || 'N/A',
                        postal: ipInfo.postal || 'N/A',
                        timezone: ipInfo.timezone || 'N/A'
                    };
                })
                .catch(error => {
                    // Nếu không lấy được thông tin chi tiết, trả về chỉ địa chỉ IP
                    console.error('Error fetching IP details:', error);
                    return { ip: data.ip };
                });
        })
        .catch(error => {
            console.error('Error fetching IP address:', error);
            
            // Thử phương pháp dự phòng với API khác
            return fetch('https://api64.ipify.org?format=json')
                .then(response => response.json())
                .then(data => ({ ip: data.ip }))
                .catch(backupError => {
                    console.error('Backup IP fetch failed:', backupError);
                    return { ip: 'Unknown' };
                });
        });
}
