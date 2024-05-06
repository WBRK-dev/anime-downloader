let searchTimeout;
let animeSearchResults = [];
let animeEpisodes = [];

function searchWithTimeout() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(search, 3000);
}

async function search() {
    const query = document.querySelector("#animesearch #search input").value;
    const response = await (await api(`/search?q=${query}`)).json();
    animeSearchResults = response.animes;

    const animeResultsWrapper = document.querySelector("main #animesearch .animegrid");
    animeResultsWrapper.innerHTML = "";
    for (let i = 0; i < animeSearchResults.length; i++) {
        const anime = animeSearchResults[i];
        animeResultsWrapper.innerHTML += `<button class="animecard" onclick="openSearchResult(${i})"><img src="${anime.poster}"><p class="title">${anime.name}</p></button>`;
    }
}

async function openSearchResult(i) {
    const searchPage = page.get("animesearch", "search");
    const episodesPage = page.get("animesearch", "episodes-wrapper");
    const episodeList = episodesPage.querySelector("#episodes #episode-list");

    episodesPage.querySelector("#info img").src = animeSearchResults[i].poster;
    episodesPage.querySelector("#info #title").innerHTML = animeSearchResults[i].name;
    episodesPage.querySelector("#info #sub").innerHTML = animeSearchResults[i].episodes.sub || 0;
    episodesPage.querySelector("#info #dub").innerHTML = animeSearchResults[i].episodes.dub || 0;
    episodesPage.querySelector("#episodes input#start").value = "";
    episodesPage.querySelector("#episodes input#end").value = "";
    episodeList.innerHTML = "";

    searchPage.style.display = "none";
    episodesPage.style.display = "";

    const response = await (await api(`/episodes/${animeSearchResults[i].id}`)).json();
    animeEpisodes = response.episodes;

    for (let i = 0; i < animeEpisodes.length; i++) {
        const episode = animeEpisodes[i];
        episodeList.innerHTML += `<button>${episode.number}</button>`;
    }
}

function backToSearch() {
    const searchPage = page.get("animesearch", "search");
    const episodesPage = page.get("animesearch", "episodes-wrapper");
    episodesPage.style.display = "none";
    searchPage.style.display = "";
}

function checkInputOnDigits(elem) {
    const startInput = elem.getAttribute("id") === "start" ? elem : document.querySelector("#episodes input#start");
    const endInput = elem.getAttribute("id") === "end" ? elem : document.querySelector("#episodes input#end");

    if (elem.value && /^\d+$/.test(elem.value) && 
        ( 
           ( elem.getAttribute("id") === "start" && Number(elem.value) > 0 ) ||
           ( elem.getAttribute("id") === "end" && Number(elem.value) <= animeEpisodes.length )
        )
    ) {
        elem.classList.remove("input-danger");
    } else if (elem.value) {
        elem.classList.add("input-danger");
        return;
    } else {
        elem.classList.remove("input-danger");
    }

    if (startInput.value && endInput.value && /^\d+$/.test(startInput.value) && /^\d+$/.test(endInput.value) && Number(startInput.value) > Number(endInput.value)) {
        startInput.classList.add("input-danger");
        endInput.classList.add("input-danger");
    } else if (startInput.value && endInput.value && /^\d+$/.test(startInput.value) && /^\d+$/.test(endInput.value)) {
        renderSelectedEpisodes();
    }
}

function renderSelectedEpisodes() {
    const startInput = Number(document.querySelector("#episodes input#start").value);
    const endInput = Number(document.querySelector("#episodes input#end").value);
    const episodeList = document.querySelector("#episodes #episode-list");
    const downloadBtn = document.querySelector("#episodes-wrapper #downloadbtn");

    const episodeElements = episodeList.querySelectorAll("button");
    episodeElements.forEach(el => el.classList.remove("active"));

    for (let i = 0; i < animeEpisodes.length; i++) {
        const episode = animeEpisodes[i];
        if (i + 1 >= startInput && i + 1 <= endInput) {
            episodeElements[i].classList.add("active");
        }
    }

    downloadBtn.querySelector("#amount").innerHTML = (endInput - startInput) + 1;
}

function makeDownloadReady() {
    const startInput = document.querySelector("#episodes input#start").value;
    const endInput = document.querySelector("#episodes input#end").value;
    if (startInput && endInput && /^\d+$/.test(startInput) && /^\d+$/.test(endInput) && Number(startInput) < Number(endInput) && Number(startInput) > 0 && Number(endInput) <= animeEpisodes.length) {

        episodesToDownload = animeEpisodes.filter((ep, i) => i + 1 >= startInput && i + 1 <= endInput);

        page.get("animesearch", "episodes-wrapper").querySelector(".backbutton").setAttribute("disabled", "");
        page.get("animesearch", "episodes-wrapper").querySelector("#downloadbtn").setAttribute("disabled", "");

        download();

    } else {

    }
}