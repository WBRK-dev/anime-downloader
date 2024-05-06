function api(route) {
    return fetch(`http://localhost:4000/anime${route}`);
}

const page = {
    get: (pageId, subPageId) => document.querySelector(`main #${pageId} #${subPageId}`),
}