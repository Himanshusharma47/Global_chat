
function formatLastSeen(timestamp, isOnline = false) {
    if (isOnline) {
        return 'Online';
    }

    if (!timestamp) {
        return 'Offline';
    }

    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if valid date
    if (isNaN(date.getTime())) {
        return 'Offline';
    }

    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);

    // Just now (less than 1 minute)
    if (diffMinutes < 1) {
        return 'Last seen just now';
    }

    // Time formatting helper
    const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Today
    if (date.toDateString() === now.toDateString()) {
        return `Last seen today at ${timeString}`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Last seen yesterday at ${timeString}`;
    }

    // Older than yesterday
    const dateString = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return `Last seen on ${dateString}`;
}

module.exports = { formatLastSeen };
