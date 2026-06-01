self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// Remove no-op fetch handler to avoid overhead during navigation
// self.addEventListener("fetch", () => {
//     return;
// });
