/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
function loadFile(filePath) { // https://stackoverflow.com/a/41133213/11519302
    var result = null;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.setRequestHeader("x-requested-with", "XMLHttpRequest");
    xmlhttp.send();
    if (xmlhttp.status == 200) {
        result = xmlhttp.responseText;
    }
    return result;
}

// Get remote control
commitsList = JSON.parse(loadFile("https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits"));
latestCommit = JSON.parse(loadFile(commitsList[0].url));
remoteControl = latestCommit.files["remoteControl.json"].content;
remoteControl = JSON.parse(remoteControl);
downMsg = remoteControl.downMsg;

// Act on Remote Control
if (downMsg == undefined) {
    downMsg = "";
}
if (remoteControl.run == true) {
    console.log("Remote Control OK!");
    // Only proceed if site is not disabled
    
    // Get version manifest
    versionManifest = JSON.parse(loadFile("https://cors-anywhere.herokuapp.com/https://launchermeta.mojang.com/mc/game/version_manifest.json"));
    console.log(versionManifest.latest.snapshot);

} else{
    document.getElementById("body").innerHTML = "<p>The Options Background Generator has been disabled remotely. Check back later?</p><p><small><em>"+downMsg+"</em></small></p>";
}

function readValue() {
    var blocks = document.getElementById("blocks");
    var selectedBlock = blocks.value;
    console.log(selectedBlock);
}
