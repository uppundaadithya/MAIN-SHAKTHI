document.addEventListener('DOMContentLoaded', () => {
    const emergencyBtn = document.getElementById('emergencyBtn');
    

    emergencyBtn.addEventListener('click', () => {
        const phoneNumber = emergencyBtn.getAttribute('data-number');
        
        // Optional: Add a confirmation to prevent accidental dials
        confirm('Are you sure you want to call this number?');
        const confirmCall = `Call ${phoneNumber}?`
        
        if (confirmCall) {
            window.location.href = `tel:${phoneNumber}`;
        }
    });

    document.getElementById('location').addEventListener('click', function() {
    const phoneNumber = "7624989627"; // Replace with the specific contact number

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Create a Google Maps lin
            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;
            const message = encodeURIComponent(`My current location: ${mapLink}`);

            // Open the SMS app
            window.location.href = `sms:${phoneNumber}?&body=${message}`;
            
        }, (error) => {
            alert("Error: Please enable location permissions.");
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
});

});

