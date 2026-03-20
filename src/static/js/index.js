import {gsap} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm";
import {WebHaptics} from "https://cdn.jsdelivr.net/npm/web-haptics@0.0.6/+esm";
import {Draggable} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/Draggable.min.js";

const haptics = new WebHaptics();

const socket = new WebSocket("wss://api.playontable.com/websocket/");
const {
    entry,
    start,
    enter,
    watch,
    table,
    panel,
    allow,
    room,
    code,
    send,
    join
} = Object.fromEntries([
    "entry",
    "start",
    "enter",
    "watch",
    "table",
    "panel",
    "allow",
    "room",
    "code",
    "send",
    "join"
].map(id => [id, document.getElementById(id)]));

const config = {
    onPress() {this.applyBounds({top: 10 - table?.scrollTop, left: 10 - table?.scrollLeft});},
    onDragStart() {socket.send(JSON.stringify({hook: "step", index: Array.from(table.children).indexOf(this.target)}));},
    onDrag() {
        haptics.trigger([{duration: 10, intensity: 0.2}]);
        socket.send(JSON.stringify({hook: "drag", data: {x: this.x, y: this.y, zIndex: parseInt(getComputedStyle(this.target).zIndex, 10)}, index: Array.from(table.children).indexOf(this.target)}));
    },
    onClick() {
        if (this.target.classList.contains("copy")) {
            panel?.close();
            document.querySelector("#table > .selected")?.classList.remove("selected");
            this.target.classList.add("selected");
            panel?.show();
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
            socket?.send(JSON.stringify({hook: "host", mode: "room"}));
            break;
        case "enter room":
            enter?.show();
            break;
        case "start solo":
            socket?.send(JSON.stringify({hook: "host", mode: "solo"}));
            break;
    }
});

start?.addEventListener("close", () => {
    switch (start.returnValue) {
        case "start room":
            socket?.send(JSON.stringify({hook: "play"}));
            break;
        case "back":
            entry?.show();
            break;
    }
});

enter?.addEventListener("close", () => {
    switch (enter.returnValue) {
        case "enter room":
            socket?.send(JSON.stringify({hook: "join", code: join?.value.toUpperCase()}));
            break;
        case "back":
            entry?.show();
            break;
    }
});

const getSelectedChild = () => document.querySelector("#table > .selected");

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
        wipe: !!selected,
        hand: !!selected,
        fall: !!selected && hands,
        draw: !!selected && decks,
        flip: !!selected && cards,
        roll: !!selected && dices
    };
}

const toggleAction = (action, show) => action?.classList.toggle("show", show);

function setActionsVisibility({hand = false, fall = false, draw = false, flip = false, roll = false, wipe = true} = {}) {
    toggleAction(actions.hand, hand);
    toggleAction(actions.fall, fall);
    toggleAction(actions.draw, draw);
    toggleAction(actions.flip, flip);
    toggleAction(actions.roll, roll);
    toggleAction(actions.wipe, wipe);
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
            break;
        case "fall":
            getSelectedChild()?.classList.toggle("hands");
            socket.send(JSON.stringify({hook: "fall", index: Array.from(table.children).indexOf(getSelectedChild())}));
            break;
        case "draw":
            break;
        case "flip":
            break;
        case "roll":
            socket?.send(JSON.stringify({hook: "roll", index: Array.from(table.children).indexOf(getSelectedChild())}));
            break;
        case "wipe":
            allow?.showModal();
            break;
    }
});

allow?.addEventListener("close", () => {
    if (allow.returnValue === "wipe") socket?.send(JSON.stringify({hook: "wipe", index: Array.from(table?.children).indexOf(getSelectedChild())}));
});

table?.addEventListener("click", (event) => {if (event.target === event.currentTarget) {getSelectedChild().classList.remove("selected"); panel?.close();}});

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
                    start.show();
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
            start?.show();
            code.textContent = code;
            break;
        case "join":
            watch?.show();
            break;
        case "play":
            if (watch.open) watch.close();
            document.body.dataset.overlay = "off";
            break;
        case "step":
            child.classList.toggle("dragging");
            break;
        case "drag":
            gsap.set(child, data);
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