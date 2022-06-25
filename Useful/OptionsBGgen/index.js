/** Utility function that uses the CORS Everywhere service to access a URL without CORS errors
 * @param {string} url
 */
function corsEverywhere(url) {
    return "https://rocky-castle-55647.herokuapp.com/" + url;
}

function loadFile(filePath) {
    // https://stackoverflow.com/a/41133213/11519302
    var result = null;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xmlhttp.send();
    if (xmlhttp.status == 200) {
        result = xmlhttp.responseText;
    }
    return result;
}

function checkBranches(value){
    console.log(value.name);
    if (value.name == versionManifest.latest.snapshot){
        console.log(true);
    }
}

/** Fetches the data from the site's remote control gist
 * @returns {{run: boolean, downMsg: string}}
 */
function getRemoteControl() {
    const commitList = JSON.parse(loadFile(Endpoints.VERSION_MANIFEST));
    const latestCommit = JSON.parse(loadFile(commitList[0].url));
    const rawContent = latestCommit.files["remoteControl.json"].content;
    return JSON.parse(rawContent);
}

/** @enum {string} */
const Endpoints = {
    REMOTE_CONTROL_COMMITS:
        "https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits",
    VERSION_MANIFEST:
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    MINECRAFT_ASSETS_BRANCHES:
        "https://api.github.com/repos/InventivetalentDev/minecraft-assets/branches?page=3",
};

const remoteControl = getRemoteControl();
const downMsg = remoteControl.downMsg || "";


// Only proceed if site is not disabled
if (remoteControl.run == true) {
    console.log("Remote Control OK!");
    
    // Get version manifest
    versionManifest = JSON.parse(loadFile(Endpoints.VERSION_MANIFEST));
    console.log(versionManifest.latest.snapshot);

    branches = JSON.parse(loadFile(Endpoints.MINECRAFT_ASSETS_BRANCHES));
    console.log(branches);

    var i;
    branches.forEach(checkBranches);

} else{
    document.getElementById("body").innerHTML = "<p>The Options Background Generator has been disabled remotely. Check back later?</p><p><small><em>"+downMsg+"</em></small></p>";
}

function readValue() {
    var blocks = document.getElementById("blocks");
    var selectedBlock = blocks.value;
    console.log(selectedBlock);
}
