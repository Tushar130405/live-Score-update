console.log('Batsman stats simple test loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded for batsman stats');
    
    // Test basic functionality
    const testElement = document.getElementById('batsman-stats-tbody');
    if (testElement) {
        console.log('Found batsman stats table body');
        testElement.innerHTML = '<tr><td colspan="14">Test data loaded successfully</td></tr>';
    } else {
        console.error('Could not find batsman stats table body');
    }
    
    // Test API call
    async function testAPI() {
        try {
            console.log('Testing API call...');
            const response = await fetch('http://localhost:3000/api/players');
            console.log('API response status:', response.status);
        } catch (error) {
            console.error('API test failed:', error);
        }
    }
    
    testAPI();
}); 