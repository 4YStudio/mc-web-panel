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

const datPath = 'instances/default/world/playerdata/b4471753-7662-4938-942f-fa87e79ad2c4.dat';
const compressed = fs.readFileSync(datPath);
const data = zlib.gunzipSync(compressed);

const reader = new NBTReader(data);
const root = reader.readTag();
console.log('Root name:', root.name);
console.log('Keys:', Object.keys(root.value));
console.log('Pos:', root.value.Pos);
console.log('Dimension:', root.value.Dimension);
