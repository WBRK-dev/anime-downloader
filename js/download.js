let episodesToDownload = [];

function renderEpisodesToDownload() {
    const downloadList = page.get("downloads", "download-list");
    
    for (let i = 0; i < episodesToDownload.length; i++) {
        const elem = document.createElement("div");
        elem.innerHTML = `<div id="info"><p>Episode ${episodesToDownload[i].number}</p><p id="status">Waiting</p></div><div class="w-progressbar" style="--width: 0%;"><p class="w-progressbar-text-start"></p><p class="w-progressbar-text-end"></p></div>`;
        downloadList.append(elem);
        episodesToDownload[i].elem = elem;
    }

}