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
const joinRoom = enter?.querySelector("button[value = 'enter room']");
const getSelectedChild = () => document.querySelector("#table > .selected");
const getItem = (child) => Array.from(table.children).indexOf(child);
const getDots = (child, drag) => ({item: getItem(child), x: drag.x, y: drag.y, zIndex: parseInt(getComputedStyle(child).zIndex, 10) || 0});
const getDeckData = (child) => ({
    item: getItem(child),
    deck: child.classList.contains("ita") ? "ita" : "fra",
    color: child.classList.contains("blue") ? "blue" : child.classList.contains("red") ? "red" : null,
    jolly: child.classList.contains("jolly")
});
const getBack = (data) => data.deck === "ita" ? "static/assets/table/decks/back/ita.webp" : `static/assets/table/decks/back/fra/${data.color}.webp`;
const getFace = (child, face) => child.setAttribute("src", face === "front" ? child.dataset.front : child.dataset.back);
const getItemChild = (item) => table.children[item];

const config = {
    onPress() {this.applyBounds({top: 10 - table?.scrollTop, left: 10 - table?.scrollLeft});},
    onDragStart() {socket.send(JSON.stringify({hook: "step", data: {item: getItem(this.target)}}));},
    onDrag() {
        haptics.trigger([{duration: 10, intensity: 0.2}]);
        socket.send(JSON.stringify({hook: "drag", data: getDots(this.target, this)}));
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
        socket.send(JSON.stringify({hook: "step", data: {item: getItem(this.target)}}));
        if (!this.target.classList.contains("copy")) socket.send(JSON.stringify({hook: "copy", data: getDots(this.target, this)}));
    }
}

gsap.registerPlugin(Draggable);
Draggable.create("#table > *", config);

send?.addEventListener("click", () => {navigator.share({text: code?.innerText});});

entry?.addEventListener("close", () => {
    switch (entry.returnValue) {
        case "start room":
            socket?.send(JSON.stringify({hook: "host", data: {mode: "room"}}));
            break;
        case "enter room":
            enter?.show();
            break;
        case "start solo":
            socket?.send(JSON.stringify({hook: "host", data: {mode: "solo"}}));
            break;
    }
});

start?.addEventListener("close", () => {
    switch (start.returnValue) {
        case "start room":
            socket?.send(JSON.stringify({hook: "play", data: {}}));
            break;
        case "back":
            entry?.show();
            break;
    }
});

enter?.addEventListener("close", () => {
    switch (enter.returnValue) {
        case "enter room":
            socket?.send(JSON.stringify({hook: "join", data: {code: join?.value.toUpperCase()}}));
            break;
        case "back":
            entry?.show();
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
    const dices = selected?.classList?.contains("dices");
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
    const selected = getSelectedChild();
    switch (panel.returnValue) {
        case "hand":
            if (selected) {
                selected.classList.toggle("hands");
                socket.send(JSON.stringify({hook: "hand", data: {item: getItem(selected)}}));
            }
            break;
        case "fall":
            if (selected) {
                selected.classList.toggle("hands");
                socket.send(JSON.stringify({hook: "fall", data: {item: getItem(selected)}}));
            }
            break;
        case "draw":
            if (selected?.classList.contains("decks")) socket.send(JSON.stringify({hook: "draw", data: getDeckData(selected)}));
            break;
        case "flip":
            if (selected?.classList.contains("cards")) socket.send(JSON.stringify({hook: "flip", data: {item: getItem(selected)}}));
            break;
        case "roll":
            if (selected) socket.send(JSON.stringify({hook: "roll", data: {item: getItem(selected)}}));
            break;
        case "wipe":
            if (selected) allow?.showModal();
            break;
    }
});

allow?.addEventListener("close", () => {
    const selected = getSelectedChild();
    if (allow.returnValue === "wipe" && selected) socket.send(JSON.stringify({hook: "wipe", data: {item: getItem(selected)}}));
});

table?.addEventListener("click", (event) => {if (event.target === event.currentTarget) {getSelectedChild()?.classList.remove("selected"); panel?.close();}});

socket?.addEventListener("message", (({data: json}) => {
    const {hook, data} = JSON.parse(json);
    switch (hook) {
        case "fail":
            switch (data?.fail ?? data) {
                case "none":
                    joinRoom?.setAttribute("disabled", "");
                    if (joinRoom) joinRoom.textContent = "ROOM IS NON-EXISTENT !";
                    setTimeout(() => {
                        joinRoom?.removeAttribute("disabled");
                        if (joinRoom) joinRoom.textContent = "ENTER ROOM";
                    }, 3000);
                    break;
                case "play":
                    joinRoom?.setAttribute("disabled", "");
                    if (joinRoom) joinRoom.textContent = "ROOM ALREADY STARTED !";
                    setTimeout(() => {
                        joinRoom?.removeAttribute("disabled");
                        if (joinRoom) joinRoom.textContent = "ENTER ROOM";
                    }, 3000);
                    break;
                case "void":
                    start?.show();
                    room?.setAttribute("disabled", "");
                    if (room) room.textContent = "ONLY YOU !";
                    setTimeout(() => {
                        room?.removeAttribute("disabled");
                        if (room) room.textContent = "START ROOM";
                    }, 3000);
                    break;
            }
            break;
        case "room":
            if (watch?.open) watch.close();
            start?.show();
            code.textContent = data.code;
            break;
        case "join":
            watch?.show();
            break;
        case "play":
            if (watch?.open) watch.close();
            document.body.dataset.overlay = "off";
            break;
        case "step":
            getItemChild(data.item)?.classList.toggle("dragging");
            break;
        case "drag":
            if (getItemChild(data.item)) gsap.set(getItemChild(data.item), data);
            break;
        case "copy": {
            const child = getItemChild(data.item);
            if (!child) break;
            const clone = table.appendChild(child.cloneNode(true));
            clone.classList.add("copy");
            Draggable.create(clone, config);
            gsap.set(clone, data);
            gsap.set(child, {clearProps: "transform,zIndex"});
            break;
        }
        case "hand":
        case "fall":
            getItemChild(data.item)?.classList.toggle("hides");
            break;
        case "draw": {
            const deck = getItemChild(data.item);
            if (!deck) break;
            const card = table.appendChild(document.createElement("img"));
            const tableBox = table.getBoundingClientRect();
            const deckBox = deck.getBoundingClientRect();
            card.classList.add("cards", "copy", data.deck);
            if (data.color) card.classList.add(data.color);
            card.dataset.back = getBack(data);
            card.dataset.front = `static/assets/table/decks/front/${data.deck}/${data.card}.webp`;
            card.dataset.face = "back";
            card.setAttribute("alt", `${data.deck} ${data.card}`);
            getFace(card, card.dataset.face);
            Draggable.create(card, config);
            gsap.set(card, {x: deckBox.left - tableBox.left + table.scrollLeft + 20, y: deckBox.top - tableBox.top + table.scrollTop + 20, zIndex: 1});
            break;
        }
        case "flip": {
            const card = getItemChild(data.item);
            if (!card || !card.dataset.front || !card.dataset.back) break;
            card.dataset.face = card.dataset.face === "front" ? "back" : "front";
            getFace(card, card.dataset.face);
            break;
        }
        case "roll": {
            const dice = getItemChild(data.item);
            if (!dice) break;
            data.dice.forEach((face, index) => {
                setTimeout(() => {
                    if (table.contains(dice)) dice.setAttribute("src", `static/assets/table/dices/${dice.classList[0]}/${face}.webp`);
                }, 125 * index);
            });
            break;
        }
        case "wipe":
            allow?.close();
            getItemChild(data.item)?.remove();
            panel.removeAttribute("class");
            break;
    }
}));