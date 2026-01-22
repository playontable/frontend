import {gsap} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm";
import {Draggable} from "https://cdn.jsdelivr.net/npm/gsap@3.13.0/Draggable.min.js";

const socket = new WebSocket("wss://api.playontable.com/websocket/");
const {lobby, table, panel, allow, code, send, room, join, solo, hand, fall, draw, flip, roll, wipe, okay, back} = Object.fromEntries(["lobby", "table", "panel", "allow", "code", "send", "room", "join", "solo", "hand", "fall", "draw", "flip", "roll", "wipe", "okay", "back"].map(id => [id, document.getElementById(id)]));
const getSelectedChild = () => table.querySelector("#table > .selected");
const toggleHandAndSend = (hook) => {
    const child = getSelectedChild();
    child.classList.toggle("hand");
    panel.className = child.className;
    socket.send(JSON.stringify({hook, index: Array.from(table.children).indexOf(child)}));
};
const config = {
    onPress() {this.applyBounds({top: 10 - table.scrollTop, left: 10 - table.scrollLeft});},
    onDragStart() {socket.send(JSON.stringify({hook: "drop", index: Array.from(table.children).indexOf(this.target)}));},
    onDrag() {socket.send(JSON.stringify({hook: "drag", data: {x: this.x, y: this.y, zIndex: parseInt(getComputedStyle(this.target).zIndex, 10)}, index: Array.from(table.children).indexOf(this.target)}));},
    onClick() {if (this.target.classList.contains("copy")) {table.querySelectorAll(".selected").forEach(child => child.classList.remove("selected")); this.target.classList.add("selected"); panel.className = this.target.className;}},
    onDragEnd() {socket.send(JSON.stringify({hook: "drop", index: Array.from(table.children).indexOf(this.target)})); if (!this.target.classList.contains("copy")) socket.send(JSON.stringify({hook: "copy", data: {startX: this.startX, startY: this.startY}, index: Array.from(table.children).indexOf(this.target)}));}
}

lobby.showModal();

gsap.registerPlugin(Draggable);
Draggable.create("#table > *", config);
table.addEventListener("click", (event) => {if (event.target === event.currentTarget) {panel.removeAttribute("class"); const child = getSelectedChild(); if (child) child.classList.remove("selected");}});

send.addEventListener("click", () => {navigator.share({text: code.innerText});});
room.addEventListener("click", () => {socket.send(JSON.stringify({hook: "room"}));});
join.addEventListener("input", () => {if (join.value.length === 5) socket.send(JSON.stringify({hook: "join", data: join.value}));});
solo.addEventListener("click", () => {socket.send(JSON.stringify({hook: "solo"}));});
hand.addEventListener("click", () => {toggleHandAndSend("hand");});
fall.addEventListener("click", () => {toggleHandAndSend("fall");});
draw.addEventListener("click", () => {});
flip.addEventListener("click", () => {});
roll.addEventListener("click", () => {const rollAnimation = setInterval(() => {socket.send(JSON.stringify({hook: "roll", data: Math.floor(Math.random() * 6) + 1, index: Array.from(table.children).indexOf(getSelectedChild())}));}, 100); setTimeout(() => {clearInterval(rollAnimation);}, 1000);});
wipe.addEventListener("click", () => {allow.showModal();});
okay.addEventListener("click", () => {socket.send(JSON.stringify({hook: "wipe", index: Array.from(table.children).indexOf(getSelectedChild())})); allow.close();});
back.addEventListener("click", () => {allow.close();});

socket.addEventListener("message", (({data: json}) => {
    const {hook, data, index} = JSON.parse(json);
    const child = (index !== undefined && index !== null) ? table.children[index] : null;
    switch (hook) {
        case "code":
            setTimeout(() => {
                code.textContent = data;
                code.classList.remove("load");
                code.classList.add("show");
                send.classList.add("show");
                setTimeout(() => code.classList.remove("show"), 200);
            }, 2000);
            break;
        case "fail":
            room.disabled = true;
            room.classList.toggle("jolt");
            room.textContent = "YOU ARE ALONE!";
            setTimeout(() => {
                room.disabled = false;
                room.classList.toggle("jolt");
                room.textContent = "START ROOM";
            }, 3000);
            break;
        case "room":
        case "solo":
            lobby.close();
            break;
        case "copy":
            const clone = child.cloneNode(true);
            clone.classList.add("copy");
            table.append(clone);
            Draggable.create(clone, config);
            gsap.to(child, {x: data.startX, y: data.startY, duration: 0});
            break;
        case "drop":
            child.classList.toggle("dragging");
            break;
        case "drag":
            gsap.to(child, {x: data.x, y: data.y, zIndex: data.zIndex, duration: 0});
            break;
        case "hand":
        case "fall":
            child.classList.toggle("hide");
            if (child === getSelectedChild()) {panel.removeAttribute("class"); child.classList.remove("selected");}
            break;
        case "draw":
            break;
        case "flip":
            break;
        case "roll":
            child.setAttribute("src", `static/assets/table/dices/${child.classList[0]}/${data}.webp`);
            break;
        case "wipe":
            child.remove();
            panel.removeAttribute("class");
            break;
    }
}));