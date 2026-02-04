import {gsap} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm";
import {Draggable} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/Draggable.min.js";

const socket = new WebSocket("wss://api.playontable.com/websocket/");
const {
    entry,
    start,
    enter,
    table,
    panel,
    allow,
    shade,
    code,
    send
} = Object.fromEntries([
    "entry",
    "start",
    "enter",
    "table",
    "panel",
    "allow",
    "shade",
    "code",
    "send"
].map(id => [id, document.getElementById(id)]));

const getSelectedChild = () => table.querySelector("#table > .selected");
const toggleHandAndSend = () => {
    const child = getSelectedChild();
    child.classList.toggle("hand");
    panel.className = child.className;
    socket.send(JSON.stringify({hook: "drop", index: Array.from(table.children).indexOf(child)}));
};
const config = {
    onPress() {this.applyBounds({top: 10 - table?.scrollTop, left: 10 - table?.scrollLeft});},
    onDragStart() {socket.send(JSON.stringify({hook: "step", index: Array.from(table.children).indexOf(this.target)}));},
    onDrag() {socket.send(JSON.stringify({hook: "drag", data: {x: this.x, y: this.y, zIndex: parseInt(getComputedStyle(this.target).zIndex, 10)}, index: Array.from(table.children).indexOf(this.target)}));},
    onClick() {
        if (this.target.classList.contains("copy")) {
            this.target.classList.add("selected");
            openDialog();
        }
    },
    onDragEnd() {
        socket.send(JSON.stringify({hook: "step", index: Array.from(table.children).indexOf(this.target)}));
        if (!this.target.classList.contains("copy")) socket.send(JSON.stringify({hook: "copy", data: {x: this.startX, y: this.startY}, index: Array.from(table.children).indexOf(this.target)}));}
}

gsap.registerPlugin(Draggable);
Draggable.create("#table > *", config);

entry?.showModal();
entry?.addEventListener("close", () => {
    switch (entry.returnValue) {
        case "start room":
            start?.showModal();
            socket?.send(JSON.stringify({hook: "make"}));
            break;
        case "enter room":
            enter?.showModal();
            break;
        case "start solo":
            socket?.send(JSON.stringify({hook: "make"}));
            break;
    }
});

function layoutShade() {
    const r = getSelectedChild()?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const top = shade.querySelector("[data-piece='top']");
    const left = shade.querySelector("[data-piece='left']");
    const right = shade.querySelector("[data-piece='right']");
    const bottom = shade.querySelector("[data-piece='bottom']");

    top.style.top = "0px";
    top.style.left = "0px";
    top.style.width = vw + "px";
    top.style.height = Math.max(0, r.top) + "px";

    bottom.style.left = "0px";
    bottom.style.width = vw + "px";
    bottom.style.top = Math.max(0, r.bottom) + "px";
    bottom.style.height = Math.max(0, vh - r.bottom) + "px";

    left.style.left = "0px";
    left.style.top = Math.max(0, r.top) + "px";
    left.style.width = Math.max(0, r.left) + "px";
    left.style.height = Math.max(0, r.height) + "px";

    right.style.top = Math.max(0, r.top) + "px";
    right.style.left = Math.max(0, r.right) + "px";
    right.style.height = Math.max(0, r.height) + "px";
    right.style.width = Math.max(0, vw - r.right) + "px";
}

function openDialog() {
    shade.hidden = false;
    layoutShade();
    panel.style.zIndex = String((parseInt(getComputedStyle(getSelectedChild()).zIndex, 10) || 0) + 1);
    panel.show();
    document.addEventListener("scroll", layoutShade, true);
    window.addEventListener("resize", layoutShade);
}

function closeDialog() {
    panel.close();
    shade.hidden = true;
    document.removeEventListener("scroll", layoutShade, true);
    window.removeEventListener("resize", layoutShade);
}

shade.addEventListener("click", closeDialog);

const actions = {
    hand: panel.querySelector("button[value='hand']"),
    fall: panel.querySelector("button[value='fall']"),
    draw: panel.querySelector("button[value='draw']"),
    flip: panel.querySelector("button[value='flip']"),
    roll: panel.querySelector("button[value='roll']"),
    wipe: panel.querySelector("button[value='wipe']")
};

function getActionsVisibility(selected) {
    const decks = selected?.classList?.contains("decks");
    const cards = selected?.classList?.contains("cards");
    const chips = selected?.classList?.contains("chips");
    const dices = selected?.classList?.contains("dices");
    const board = selected?.classList?.contains("board");
    const chess = selected?.classList?.contains("chess");
    const dames = selected?.classList?.contains("dames");
    const hands = selected?.classList?.contains("hands");

    return {
        hand: !!selected && (decks || cards || chips || dices || board || chess || dames),
        fall: !!selected && hands,
        draw: !!selected && decks,
        flip: !!selected && cards,
        roll: !!selected && dices,
        wipe: !!selected
    };
}

function setActionsVisibility({hand = false, fall = false, draw = false, flip = false, roll = false, wipe = true} = {}) {
    actions.hand.hidden = !hand;
    actions.fall.hidden = !fall;
    actions.draw.hidden = !draw;
    actions.flip.hidden = !flip;
    actions.roll.hidden = !roll;
    actions.wipe.hidden = !wipe;
}

panel?.addEventListener("toggle", () => {
    if (panel.open) setActionsVisibility(getActionsVisibility(getSelectedChild()));
    else getSelectedChild()?.classList?.remove("selected");
});

panel?.addEventListener("close", () => {
    switch (panel.returnValue) {
        case "hand":
        case "fall":
            toggleHandAndSend();
            break;
        case "draw":
            break;
        case "flip":
            break;
        case "roll":
            socket?.send(JSON.stringify({hook: "roll", data: gsap.utils.shuffle([1, 2, 3, 4, 5, 6]), index: Array.from(table.children).indexOf(getSelectedChild())}));
            break;
        case "wipe":
            allow?.showModal();
            break;
    }
});

allow?.addEventListener("close", () => {
    switch (allow.returnValue) {
        case "wipe":
            socket?.send(JSON.stringify({hook: "wipe", index: Array.from(table?.children).indexOf(getSelectedChild())}));
            break;
        case "back":
            allow?.close();
            break;
    }
});

socket?.addEventListener("message", (({data: json}) => {
    const {hook, data, index} = JSON.parse(json);
    const child = (index !== undefined && index !== null) ? table.children[index] : null;
    switch (hook) {
        case "fail":
            switch (data) {
                case "none":
                    join.textContent = "ROOM IS NON-EXISTENT !";
                    join.toggleAttribute("disabled");
                    setTimeout(() => {
                        join.textContent = "ENTER ROOM";
                        join.toggleAttribute("disabled");
                    }, 3000);
                    break;
                case "play":
                    join.textContent = "ROOM ALREADY STARTED !";
                    join.toggleAttribute("disabled");
                    setTimeout(() => {
                        join.textContent = "ENTER ROOM";
                        join.toggleAttribute("disabled");
                    }, 3000);
                    break;
                case "void":
                    room.textContent = "ONLY YOU !";
                    room.toggleAttribute("disabled");
                    setTimeout(() => {
                        room.textContent = "START ROOM";
                        room.toggleAttribute("disabled");
                    }, 3000);
                    break;
            }
            break;
        case "code":
            code.textContent = data;
            break;
        case "play":
            start.close();
            break;
        case "join":
            break;
        case "drag":
            gsap.set(child, data);
            break;
        case "step":
            child.classList.toggle("dragging");
            break;
        case "copy":
            const clone = table.appendChild(child.cloneNode(true));
            clone.classList.add("copy");
            Draggable.create(clone, config);
            gsap.set(child, data);
            break;
        case "drop":
            child.classList.toggle("hide");
            if (child === getSelectedChild()) {panel.removeAttribute("class"); child.classList.remove("selected");}
            break;
        case "draw":
            break;
        case "flip":
            break;
        case "roll":
            gsap.set(child, {repeat: 7, ease: "none", repeatDelay: 0.250, onRepeat: function () {child.setAttribute("src", `static/assets/table/dices/${child.classList[0]}/${data[this.iteration() - 2]}.webp`);}});
            break;
        case "wipe":
            allow.close();
            child.remove();
            panel.removeAttribute("class");
            break;
    }
}));

send?.addEventListener("click", () => {navigator.share({text: code?.innerText});});
// play?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "play"}));});
// join?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "join", data: room?.value.toUpperCase()}));});