const M3u8Parser = m3u8Parser.Parser;
let totalDownloadsProgressBar;
let episodesToDownloadChunks = [];
let downloadConfig = {
    category: "dub"
}

const PLAYLIST = "PLAYLIST";
const SEGMENT = "SEGMENT";
const ERROR = "ERROR";
const TS_MIMETYPE = "video/mp2t";
const START_DOWNLOAD = "Download";
const DOWNLOAD_ERROR = "Download Error";
const STARTING_DOWNLOAD = "Download starting";
const SEGMENT_STARTING_DOWNLOAD = "Segments downloading";
const SEGMENT_STICHING = "Stiching segments";
const JOB_FINISHED = "Ready for download";
const SEGMENT_CHUNK_SIZE = 10;
const EPISODE_DOWNLOAD_CHUNK_SIZE = 3;
const SEGMENTS_DIR = "/home/web_user/segments";

async function download() {

    renderEpisodesToDownload();

    const mainProgressBar = document.querySelector("#downloads .w-progressbar#main");
    const mainProgressBarPercentageLabel = mainProgressBar.querySelector(".w-progressbar-text-center");
    let totalDownloads = episodesToDownload.length;
    let currentDownloaded = 0;

    // const CHUNK_SIZE = Math.ceil(episodesToDownload.length / 3);
    episodesToDownload = episodesToDownload.map((s, i) => ({ ...s, index: i }));
    episodesToDownloadChunks = [[],[],[]];
    for (let i = 0; i < episodesToDownload.length; i++) {
        let arrayIndex = i % 3;
        if (arrayIndex === 3) arrayIndex = 0;
        episodesToDownloadChunks[arrayIndex].push(episodesToDownload[i]);
    }

    console.log(episodesToDownloadChunks);

    await Promise.all(
        episodesToDownloadChunks.map(async (array) => {
            for (let i = 0; i < array.length; i++) {
                const episode = array[i];
                
                episode.elem.querySelector("#info #status").innerHTML = "Preparing";
                
                const sourceResponse = await api(`/episode-srcs?id=${episode.episodeId}&category=${downloadConfig.category}`);
                if (!sourceResponse.ok) {
                    episode.elem.querySelector("#info #status").innerHTML = "Failed";
                    episode.elem.querySelector(".w-progressbar").style.setProperty("--width", "100%");
                    episode.elem.querySelector(".w-progressbar").classList.add("w-progressbar-danger");
                    return;
                }
                const sourceResponseJson = await sourceResponse.json();

                let hlsManifest;
                try {
                    hlsManifest = await handleManifest(sourceResponseJson.sources[0].url);
                } catch (error) {
                    episode.elem.querySelector("#info #status").innerHTML = "Failed";
                    episode.elem.querySelector(".w-progressbar").style.setProperty("--width", "100%");
                    episode.elem.querySelector(".w-progressbar").classList.add("w-progressbar-danger");
                    return;
                }

                await transformM3u8File(hlsManifest, episode.elem, episode.index);

                currentDownloaded++;
                mainProgressBar.style.setProperty("--width", `${ Math.round( 100 / totalDownloads * currentDownloaded ) }%`);
                mainProgressBarPercentageLabel.innerHTML = `${ Math.round( 100 / totalDownloads * currentDownloaded ) }%`;

            }
        })
    );

}

async function handleManifest(url) {
    const mainManifest = await parseHls({ hlsUrl: url });
    if (mainManifest.type === PLAYLIST) {
        return mainManifest.data.find(file => file.name.split("x")[1] === "720")?.uri || ( mainManifest.data.find(file => file.name.split("x")[1] === "1080")?.uri || mainManifest.data[0]?.uri );
    } else if (mainManifest.type === SEGMENT) {
        return url;
    } else {
        throw new Error("Invalid hls url");
    }
}

async function loadFfmpegCore(elem) {
    const ffmpeg = new FFmpegWASM.FFmpeg();
    const baseURL = './js/ffmpeg-core';

    ffmpeg.on('log', ({ message }) => {
        console.log(message);
    });

    ffmpeg.on('progress', ({ progress, time }) => {
        elem.progressbar.style.setProperty("--width", `${Math.round(progress * 100)}%`);
        elem.percentageLabel.innerHTML = `${Math.round(progress * 100)}%`;
        // progressbar.style["--width"] = `${Math.round(progress * 100)}%`;
        // downloadDialogProgressBarDataLeft.text(`${Math.round(progress * 100)}%`);
        // downloadDialogProgressBarDataRight.text(formatTimeFromFfmpeg(time));
        // console.log(time);
    });

    await ffmpeg.load({
        coreURL: await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await FFmpegUtil.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpeg.createDir(SEGMENTS_DIR);

    console.log("FFMPEG CORE LOADED");
    return ffmpeg;
}
// document.addEventListener("DOMContentLoaded", loadFfmpegCore);

async function transformM3u8File(m3u8File, elem, dirId) {
    const progressbar = elem.querySelector(".w-progressbar");
    const progressbarPercentageLabel = progressbar.querySelector(".w-progressbar-text-start");
    const progressbarSecondaryLabel = progressbar.querySelector(".w-progressbar-text-end");
    const statusText = elem.querySelector("#info #status");

    statusText.innerHTML = "Loading core";

    const ffmpeg = await loadFfmpegCore({ progressbar, percentageLabel: progressbarPercentageLabel, secondaryLabel: progressbarSecondaryLabel });

    statusText.innerHTML = "Downloading";

    let totalSegments = 0;
    let fetchedSegments = 0;

    try {

        ffmpeg.createDir(`${SEGMENTS_DIR}/${dirId}`);

        let getSegments = await parseHls({ hlsUrl: m3u8File, headers: {} });
        if (getSegments.type !== SEGMENT)
            throw new Error(`Invalid segment url`);

        let segments = getSegments.data.map((s, i) => ({ ...s, index: i }));

        totalSegments = segments.length;
        progressbarSecondaryLabel.innerHTML = `0/${totalSegments}`;

        let segmentChunks = [];
        for (let i = 0; i < segments.length; i += SEGMENT_CHUNK_SIZE) {
            segmentChunks.push(segments.slice(i, i + SEGMENT_CHUNK_SIZE));
        }

        let successSegments = [];

        for (let i = 0; i < segmentChunks.length; i++) {

            let segmentChunk = segmentChunks[i];

            await Promise.all(
                segmentChunk.map(async (segment) => {
                    try {
                        let fileId = `${segment.index}.ts`;
                        console.log(`Fetching ${fileId}`);
                        let getFile = await fetch(segment.uri);
    
                        if (!getFile.ok) throw new Error("File failed to fetch");
    
                        fetchedSegments++;
                        progressbar.style.setProperty("--width", `${Math.round(100 / totalSegments * fetchedSegments)}%`);
                        progressbarPercentageLabel.innerHTML = `${Math.round(100 / totalSegments * fetchedSegments)}%`;
                        progressbarSecondaryLabel.innerHTML = `${fetchedSegments}/${totalSegments}`;
    
                        ffmpeg.writeFile(
                            `${SEGMENTS_DIR}/${dirId}/${fileId}`,
                            new Uint8Array(await getFile.arrayBuffer())
                        );
                        successSegments.push(fileId);

                        console.log(`[SUCCESS] Segment downloaded ${segment.index}`);
                    } catch (error) {
                        console.log(`[ERROR] Segment download failed ${segment.index} - id ${dirId}`);
                    }
                })
            );
        }

        successSegments = successSegments.sort((a, b) => {
            let aIndex = parseInt(a.split(".")[0]);
            let bIndex = parseInt(b.split(".")[0]);
            return aIndex - bIndex;
        });

        statusText.innerHTML = "Transforming";

        await ffmpeg.exec(
            [
                "-i",
                `concat:${successSegments.map(segm => segm = `${SEGMENTS_DIR}/${dirId}/${segm}`).join("|")}`,
                "-c:v",
                "copy",
                `${SEGMENTS_DIR}/${dirId}/output.mp4`
            ]
        );

        for (const segment of successSegments.map(segm => segm = `${SEGMENTS_DIR}/${dirId}/${segm}`)) {
            try {
                ffmpeg.deleteFile(segment);
            } catch (err) { console.warn("Error whilst deleting file from FFMPEG FS", err); }
        }

        let blobUrl;

        try {
            const data = await ffmpeg.readFile(`${SEGMENTS_DIR}/${dirId}/output.mp4`);
            blobUrl = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
            ffmpeg.deleteFile(`${SEGMENTS_DIR}/${dirId}/output.mp4`);
        } catch (_) {
            console.log("Error while creating blob url", _);
            throw new Error(`Something went wrong while stiching!`);
        }

        statusText.innerHTML = "Done";
        downloadFile(blobUrl);
    } catch (_) { console.log("Transform function crashed...", _); statusText.innerHTML = "Failed"; }

    await ffmpeg.terminate();
}

function downloadFile(url) {
    const a = document.createElement("a");
    a.setAttribute("download", "video.mp4");
    a.href = url;
    a.click();
}

function formatTimeFromFfmpeg(time) {
    let totalSeconds = time / 1000000;

    let seconds = Math.round(totalSeconds % 60);
    let minutes = Math.round(Math.floor(totalSeconds / 60) % 60);
    let hours = Math.floor(totalSeconds / 3600);

    if (seconds === 60) { seconds = 0; minutes++; }
    if (minutes === 60) { minutes = 0; hours++; }

    return `${hours >= 1 ? `${formatTimeToTwoCharacters(hours)}:` : ""}${formatTimeToTwoCharacters(minutes)}:${formatTimeToTwoCharacters(seconds)}`;
}

function formatTimeToTwoCharacters(time) {
    return (String(time)).length === 1 ? `0${time}` : time;
}

// M3U8 Parser
async function parseHls({ hlsUrl, headers = {} }) {
    try {
        let url = new URL(hlsUrl);

        let response = await fetch(url.href, {
            headers: {
                ...headers,
            },
        });
        if (!response.ok) throw new Error(response.text());
        let manifest = await response.text();

        var parser = new M3u8Parser();
        parser.push(manifest);
        parser.end();

        let path = hlsUrl;

        try {
            let pathBase = url.pathname.split("/");
            pathBase.pop();
            pathBase.push("{{ URL }}");
            path = pathBase.join("/");
        } catch (perror) {
            console.info(`[Info] Path parse error`, perror);
        }

        let base = url.origin + path;

        if (parser.manifest.playlists?.length) {
            let groups = parser.manifest.playlists;

            groups = groups
                .map((g) => {
                    return {
                        name: g.attributes.NAME
                            ? g.attributes.NAME
                            : g.attributes.RESOLUTION
                                ? `${g.attributes.RESOLUTION.width}x${g.attributes.RESOLUTION.height}`
                                : `MAYBE_AUDIO:${g.attributes.BANDWIDTH}`,
                        bandwidth: g.attributes.BANDWIDTH,
                        uri: g.uri.startsWith("http")
                            ? g.uri
                            : base.replace("{{ URL }}", g.uri),
                    };
                })
                .filter((g) => g);

            return {
                type: PLAYLIST,
                data: groups,
            };
        } else if (parser.manifest.segments?.length) {
            let segments = parser.manifest.segments;
            segments = segments.map((s) => ({
                ...s,
                uri: s.uri.startsWith("http") ? s.uri : base.replace("{{ URL }}", s.uri),
            }));

            return {
                type: SEGMENT,
                data: segments,
            };
        }
    } catch (error) {
        return {
            type: ERROR,
            data: error.message,
        };
    }
}