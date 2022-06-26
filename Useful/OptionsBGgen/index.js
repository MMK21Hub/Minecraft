/** Creates an AbortController that throws as soon as it's aborted */
function volatileAbortController() {
    const controller = new AbortController();
    controller.signal.addEventListener("abort", () => {
        throw controller.signal.reason;
    });
    return controller;
}

/**
 * A utility for asynchronously fetching JSON data
 * @param {string} url
 * @param {RequestInit} [options]
 */
function fetchJSON(url, options) {
    return fetch(url.toString(), options).then((res) => res.json());
}

/** Utility function that uses the CORS Everywhere service to access a URL without CORS errors
 * @param {string} url
 */
function corsEverywhere(url) {
    return "https://rocky-castle-55647.herokuapp.com/" + url;
}

/**
 * @typedef {Object} RemoteControlData
 * @property {boolean} run
 * @property {string} downMsg
 * @property {Date} commitTimestamp
 * @property {string} commitAuthor
 */

/**
 * Fetches the data from the remote control gist: https://gist.github.com/MMK21Hub/bbd7afbc74eb582c1a9d78b031b24f94
 * @returns {Promise<RemoteControlData>}
 */
async function getRemoteControl() {
    const commitList = await fetchJSON(Endpoints.REMOTE_CONTROL_COMMITS);
    const latestCommit = await fetchJSON(commitList[0].url);
    const rawContent = latestCommit.files["remoteControl.json"].content;
    const result = JSON.parse(rawContent);

    result.commitTimestamp = new Date(latestCommit.updated_at);
    result.commitAuthor = latestCommit.owner.login;
    return result;
}

/**
 * Replaces the page's contents with a notice indicating that the site is disabled
 * @param {RemoteControlData} data The information to include in the notice
 */
function showSiteDisabledNote(data) {
    const { downMsg, commitTimestamp, commitAuthor } = data;
    const messageElement = `<p id="site-disabled-note">The Options Background Generator has been disabled remotely. Check back later?</p>`;
    document.querySelector("body").innerHTML = messageElement;
    if (!downMsg) return;

    const siteDisabledNote = document.querySelector("#site-disabled-note");
    siteDisabledNote.insertAdjacentHTML(
        "afterend",
        `<p id="site-disabled-message">Message provided by </p>`
    );
    const siteDisabledMessage = document.querySelector(
        "#site-disabled-message"
    );

    siteDisabledMessage.textContent = `Message provided by ${commitAuthor}: `;
    siteDisabledMessage.insertAdjacentHTML("beforeend", `<em></em>`);
    siteDisabledMessage.querySelector("em").textContent = downMsg;

    if (!commitTimestamp) return;
    siteDisabledMessage.insertAdjacentHTML(
        "afterend",
        `<p id="site-disabled-timestamp">Remote control last updated </p>`
    );
    document
        .querySelector("#site-disabled-timestamp")
        .insertAdjacentText("beforeend", commitTimestamp.toLocaleString());
}

/**
 * @param {AbortController} aborter
 * @returns `true` if the remote control is allowing the site to run, or if it's being ignored.
 */
async function checkRemoteControl(aborter) {
    if (window.location.host !== "mmk21hub.github.io")
        return aborter.abort(ErrorType.REMOTELY_DISABLED);

    const remoteControl = await getRemoteControl();
    if (remoteControl.run) return true;

    showSiteDisabledNote(remoteControl);
    aborter.abort(ErrorType.REMOTELY_DISABLED);
    return false;
}

async function loadSelectorContents() {
    /** @type {HTMLSelectElement} */
    const textureSelector = document.querySelector("#texture-selector");

    textureSelector.disabled = true;

    /** @type {GithubFileInfo[]} */
    const textureDirContents = await fetchJSON(Endpoints.MCMETA_BLOCK_TEXTURES);
    const textureFiles = textureDirContents.filter((f) => f.type === "file");
    console.log(
        `Fetched data for ${textureFiles.length} textures from the mcmeta repository on GitHub`
    );

    textureFiles.forEach((textureFile) => {
        const option = document.createElement("option");
        option.value = textureFile.name;
        // Only use the basename of the file (ignore the .png extension)
        option.textContent = textureFile.name.replace(/^(.*)\.(\w+)$/, "$1");
        textureSelector.appendChild(option);
    });

    textureSelector.disabled = false;
}

/**
 * @typedef {Object} GithubFileInfo
 * @property {string} name The filename of the file (includes any file extension)
 * @property {string} path The path to the file, within the repository branch (includes the filename)
 * @property {string} sha
 * @property {number} size The size of the file in bytes
 * @property {string} url The API endpoint to access the contents of the file
 * @property {string} html_url The URL that points to the file in GitHub's frontend
 * @property {string} git_url The API endpoint to access the file's contents as a Git blob
 * @property {string} download_url The raw.githubusercontent.com URL to directly download the file from
 * @property {"file" | "dir" | "symlink" | "submodule"} type Tells you if this file-like object is a file, directory, or something else
 */

async function main() {
    try {
        const aborter = volatileAbortController();
        const shouldRun = await checkRemoteControl(aborter);
    } catch (error) {
        console.error(error);
        debugger;
    }

    const versionManifest = await fetchJSON(Endpoints.VERSION_MANIFEST);
    console.log("Latest MC version", versionManifest.latest.snapshot);

    await loadSelectorContents();
}

/** @enum {string} */
const Endpoints = {
    REMOTE_CONTROL_COMMITS:
        "https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits",
    VERSION_MANIFEST:
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    MCMETA_BLOCK_TEXTURES:
        "https://api.github.com/repos/misode/mcmeta/contents/assets/minecraft/textures/block?ref=assets",
};

/** @enum {symbol} */
const ErrorType = {
    REMOTELY_DISABLED: Symbol(),
};

try {
    await main();
} catch (error) {
    console.log(error);
    debugger;
}

main().catch((error) => {
    console.warn("!!");
    if (Object.values(ErrorType).includes(error)) throw error;
    if (error === ErrorType.REMOTELY_DISABLED) return;
    throw error;
});

export {};
