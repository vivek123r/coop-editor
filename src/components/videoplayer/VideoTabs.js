// Initialize video tabs
document.addEventListener('DOMContentLoaded', () => {
  initVideoTabs();
});

// Function to be called when the component is mounted
export function initVideoTabs() {
  // Get tab elements once the DOM is ready
  setTimeout(() => {
    const tabButtons = document.querySelectorAll('.video-option-tab');
    const tabContents = document.querySelectorAll('.video-option-content');
    
    if (!tabButtons.length || !tabContents.length) return;
    
    // Add click event to tabs
    tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Hide all tab contents
        tabContents.forEach(content => content.style.display = 'none');
        
        // Show corresponding tab content
        if (tabContents[index]) {
          tabContents[index].style.display = 'block';
        }
      });
    });
  }, 100); // Small delay to ensure DOM is ready
}
