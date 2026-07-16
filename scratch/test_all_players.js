const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');

class NBTReader {
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    readTag() {
        if (this.offset >= this.buffer.length) return { type: 0, name: '', value: null };
        const type = this.buffer[this.offset++];
        if (type === 0) return { type, name: '', value: null };
        const nameLen = this.buffer.readUInt16BE(this.offset);
        this.offset += 2;
        const name = this.buffer.toString('utf8', this.offset, this.offset + nameLen);
        this.offset += nameLen;
        const value = this.readValue(type);
        return { type, name, value };
    }

    readValue(type) {
        switch (type) {
            case 1: return this.buffer[this.offset++];
            case 2: {
                const s = this.buffer.readInt16BE(this.offset);
                this.offset += 2;
                return s;
            }
            case 3: {
                const i = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                return i;
            }
            case 4: {
                const l = this.buffer.readBigInt64BE(this.offset);
                this.offset += 8;
                return Number(l);
            }
            case 5: {
                const f = this.buffer.readFloatBE(this.offset);
                this.offset += 4;
                return f;
            }
            case 6: {
                const d = this.buffer.readDoubleBE(this.offset);
                this.offset += 8;
                return d;
            }
            case 7: {
                const baLen = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                const ba = this.buffer.subarray(this.offset, this.offset + baLen);
                this.offset += baLen;
                return ba;
            }
            case 8: {
                const strLen = this.buffer.readUInt16BE(this.offset);
                this.offset += 2;
                const str = this.buffer.toString('utf8', this.offset, this.offset + strLen);
                this.offset += strLen;
                return str;
            }
            case 9: {
                const elemType = this.buffer[this.offset++];
                const listLen = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                const list = [];
                for (let k = 0; k < listLen; k++) {
                    list.push(this.readValue(elemType));
                }
                return { type: elemType, value: list };
            }
            case 10: {
                const comp = {};
                while (true) {
                    const tag = this.readTag();
                    if (tag.type === 0) break;
                    comp[tag.name] = tag.value;
                }
                return comp;
            }
            case 11: {
                const iaLen = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                const ia = [];
                for (let k = 0; k < iaLen; k++) {
                    ia.push(this.buffer.readInt32BE(this.offset));
                    this.offset += 4;
                }
                return ia;
            }
            case 12: {
                const laLen = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                const la = [];
                for (let k = 0; k < laLen; k++) {
                    la.push(Number(this.buffer.readBigInt64BE(this.offset)));
                    this.offset += 8;
                }
                return la;
            }
            default:
                throw new Error('Unknown NBT type ' + type + ' at offset ' + this.offset);
        }
    }
}

// Find all .dat files in playerdata folders
const glob = require('glob');
const files = glob.sync('instances/*/world/playerdata/*.dat');

for (const file of files) {
    try {
        const compressed = fs.readFileSync(file);
        const data = zlib.gunzipSync(compressed);
        const reader = new NBTReader(data);
        const root = reader.readTag();
        const nbt = root.value;
        if (nbt) {
            let x = 0, y = 0, z = 0;
            if (nbt.Pos && nbt.Pos.value && nbt.Pos.value.length === 3) {
                x = nbt.Pos.value[0];
                y = nbt.Pos.value[1];
                z = nbt.Pos.value[2];
            }
            const dimension = nbt.Dimension || 'minecraft:overworld';
            console.log(`File: ${file}`);
            console.log(`Pos: ${x}, ${y}, ${z}`);
            console.log(`Dim: ${dimension}`);
            console.log('---');
        }
    } catch (e) {
        console.error(`Error in ${file}:`, e.message);
    }
}
