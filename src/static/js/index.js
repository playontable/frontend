import {gsap} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm";
import {Draggable} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/Draggable.min.js";

const socket = new WebSocket("wss://api.playontable.com/websocket/");
const {
    entry,
    start,
    enter,
    watch,
    table,
    panel,
    allow,
    code,
    send
} = Object.fromEntries([
    "entry",
    "start",
    "enter",
    "watch",
    "table",
    "panel",
    "allow",
    "code",
    "send"
].map(id => [id, document.getElementById(id)]));

const getSelectedChild = () => table.querySelector("#table > .selected");

const config = {
    onPress() {this.applyBounds({top: 10 - table?.scrollTop, left: 10 - table?.scrollLeft});},
    onDragStart() {socket.send(JSON.stringify({hook: "step", index: Array.from(table.children).indexOf(this.target)}));},
    onDrag() {socket.send(JSON.stringify({hook: "drag", data: {x: this.x, y: this.y, zIndex: parseInt(getComputedStyle(this.target).zIndex, 10)}, index: Array.from(table.children).indexOf(this.target)}));},
    onClick() {
        if (this.target.classList.contains("copy")) {
            this.target.classList.add("selected");
        }
    },
    onDragEnd() {
        socket.send(JSON.stringify({hook: "step", index: Array.from(table.children).indexOf(this.target)}));
        if (!this.target.classList.contains("copy")) socket.send(JSON.stringify({hook: "copy", data: {x: this.startX, y: this.startY}, index: Array.from(table.children).indexOf(this.target)}));}
}

gsap.registerPlugin(Draggable);
Draggable.create("#table > *", config);

send?.addEventListener("click", () => {navigator.share({text: code?.innerText});});

entry?.addEventListener("close", () => {
    switch (entry.returnValue) {
        case "start room":
            start?.show();
            socket?.send(JSON.stringify({hook: "make"}));
            break;
        case "enter room":
            enter?.show();
            break;
        case "start solo":
            socket?.send(JSON.stringify({hook: "make"}));
            socket?.send(JSON.stringify({hook: "play"}));
            break;
    }
});

start?.addEventListener("close", () => {
    switch (start.returnValue) {
        case "start room":
            socket?.send(JSON.stringify({hook: "play"}));
            break;
        case "back":
            start.close();
            entry.show();
            break;
    }
});

enter?.addEventListener("close", () => {
    switch (enter.returnValue) {
        case "enter room":
            watch?.show();
            break;
        case "back":
            enter.close();
            entry.show();
            break;
    }
});

const actions = {
    hand: panel?.querySelector("button[value = 'hand']"),
    fall: panel?.querySelector("button[value = 'fall']"),
    draw: panel?.querySelector("button[value = 'draw']"),
    flip: panel?.querySelector("button[value = 'flip']"),
    roll: panel?.querySelector("button[value = 'roll']"),
    wipe: panel?.querySelector("button[value = 'wipe']")
};

function getActions(selected) {
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
    if (panel.open) setActionsVisibility(getActions(getSelectedChild()));
    else getSelectedChild()?.classList?.remove("selected");
});

panel?.addEventListener("close", () => {
    switch (panel.returnValue) {
        case "hand":
            getSelectedChild()?.classList.toggle("hands");
            socket.send(JSON.stringify({hook: "hand", index: Array.from(table.children).indexOf(getSelectedChild())}));
        case "fall":
            getSelectedChild()?.classList.toggle("hands");
            socket.send(JSON.stringify({hook: "fall", index: Array.from(table.children).indexOf(getSelectedChild())}));
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
            allow.close();
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
            if (watch.open) watch.close();
            document.body.classList.remove("shade");
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
        case "hand":
        case "fall":
            child.classList.toggle("hides");
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

// join?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "join", data: room?.value.toUpperCase()}));});