import {gsap} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm";
import {Draggable} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/Draggable.min.js";

const socket = new WebSocket("wss://api.playontable.com/websocket/");
const {lobby, table, panel, allow, code, send, room, join, solo, hand, fall, draw, flip, roll, wipe, okay, back} = Object.fromEntries(["lobby", "table", "panel", "allow", "code", "send", "room", "join", "solo", "hand", "fall", "draw", "flip", "roll", "wipe", "okay", "back"].map(id => [id, document.getElementById(id)]));
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
    onClick() {if (this.target.classList.contains("copy")) {table.querySelectorAll(".selected").forEach(child => child.classList.remove("selected")); this.target.classList.add("selected"); panel.className = this.target.className;}},
    onDragEnd() {socket.send(JSON.stringify({hook: "step", index: Array.from(table.children).indexOf(this.target)})); if (!this.target.classList.contains("copy")) socket.send(JSON.stringify({hook: "copy", data: {x: this.startX, y: this.startY}, index: Array.from(table.children).indexOf(this.target)}));}
}

lobby?.showModal();

gsap.registerPlugin(Draggable);
Draggable.create("#table > *", config);
table?.addEventListener("click", (event) => {if (event.target === event.currentTarget) {panel?.removeAttribute("class"); getSelectedChild()?.classList?.remove("selected");}});

send?.addEventListener("click", () => {navigator.share({text: code?.innerText});});
room?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "room"}));});
join?.addEventListener("input", () => {if (join.value.length === 5) socket?.send(JSON.stringify({hook: "join", data: join.value}));});
solo?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "solo"}));});
hand?.addEventListener("click", () => {toggleHandAndSend();});
fall?.addEventListener("click", () => {toggleHandAndSend();});
draw?.addEventListener("click", () => {});
flip?.addEventListener("click", () => {});
roll?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "roll", data: gsap.utils.shuffle([1, 2, 3, 4, 5, 6]), index: Array.from(table.children).indexOf(getSelectedChild())}));});
wipe?.addEventListener("click", () => {allow?.showModal();});
okay?.addEventListener("click", () => {socket?.send(JSON.stringify({hook: "wipe", index: Array.from(table?.children).indexOf(getSelectedChild())}));});
back?.addEventListener("click", () => {allow?.close();});

socket?.addEventListener("message", (({data: json}) => {
    const {hook, data, index} = JSON.parse(json);
    const child = (index !== undefined && index !== null) ? table.children[index] : null;
    switch (hook) {
        case "fail":
            room.toggleAttribute("disabled");
            room.textContent = "ONLY YOU !";
            setTimeout(() => {
                room.toggleAttribute("disabled");
                room.textContent = "START ROOM";
            }, 3000);
            break;
        case "code":
            code.textContent = data;
            break;
        case "room":
        case "solo":
            lobby.close();
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
            gsap.set(child, {repeat: 7, ease: "none", repeatDelay: 1, onRepeat: function () {child.setAttribute("src", `static/assets/table/dices/${child.classList[0]}/${data[this.iteration() - 2]}.webp`);}});
            break;
        case "wipe":
            allow.close();
            child.remove();
            panel.removeAttribute("class");
            break;
    }
}));