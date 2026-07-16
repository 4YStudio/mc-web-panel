const fs = require('fs-extra');
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
                return l;
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
                    la.push(this.buffer.readBigInt64BE(this.offset));
                    this.offset += 8;
                }
                return la;
            }
            default:
                throw new Error('Unknown NBT type ' + type + ' at offset ' + this.offset);
        }
    }
}

// Unpack Long Array for heightmap values (9 bits per value, 256 values total, NOT crossing Long boundaries)
function unpackHeightmap(longs) {
    const values = [];
    const bitsPerValue = 9;
    const mask = (1n << BigInt(bitsPerValue)) - 1n;
    const valPerLong = Math.floor(64 / bitsPerValue); // 7

    for (let i = 0; i < 256; i++) {
        const longIdx = Math.floor(i / valPerLong);
        const valIdx = i % valPerLong;
        const bitOffset = valIdx * bitsPerValue;

        const longVal = BigInt(longs[longIdx]);
        const val = (longVal >> BigInt(bitOffset)) & mask;
        values.push(Number(val));
    }
    return values;
}

// Extract block name from packed states data
function getBlockName(palette, data, index) {
    if (!palette || !palette.length) return 'minecraft:air';
    if (palette.length === 1) return palette[0].Name || 'minecraft:air';
    if (!data) return palette[0].Name || 'minecraft:air';

    const bitsPerValue = Math.max(4, Math.ceil(Math.log2(palette.length)));
    const valPerLong = Math.floor(64 / bitsPerValue);
    const longIdx = Math.floor(index / valPerLong);
    const valIdx = index % valPerLong;
    const bitOffset = valIdx * bitsPerValue;

    if (longIdx >= data.length) return 'minecraft:air';

    const longVal = BigInt(data[longIdx]);
    const val = (longVal >> BigInt(bitOffset)) & ((1n << BigInt(bitsPerValue)) - 1n);
    const palEntry = palette[Number(val)];
    return palEntry ? palEntry.Name : 'minecraft:air';
}

const mcaPath = 'instances/781e7e70/world/region/r.0.0.mca';
if (fs.existsSync(mcaPath)) {
    const fd = fs.openSync(mcaPath, 'r');
    for (let cz = 0; cz < 32; cz++) {
        for (let cx = 0; cx < 32; cx++) {
            const offsetPos = 4 * (cx + cz * 32);
            const header = Buffer.alloc(4);
            fs.readSync(fd, header, 0, 4, offsetPos);
            const offset = (header[0] << 16) | (header[1] << 8) | header[2];
            if (offset > 0) {
                const lengthBuf = Buffer.alloc(4);
                fs.readSync(fd, lengthBuf, 0, 4, offset * 4096);
                const length = lengthBuf.readUInt32BE(0);
                const meta = Buffer.alloc(1);
                fs.readSync(fd, meta, 0, 1, offset * 4096 + 4);
                const compressedData = Buffer.alloc(length - 1);
                fs.readSync(fd, compressedData, 0, length - 1, offset * 4096 + 5);

                const data = zlib.inflateSync(compressedData);
                const reader = new NBTReader(data);
                const nbt = reader.readTag().value;
                
                const heightmaps = nbt.Heightmaps || nbt.Level?.Heightmaps;
                if (heightmaps) {
                    const longs = heightmaps.WORLD_SURFACE || heightmaps.MOTION_BLOCKING;
                    if (longs) {
                        const heights = unpackHeightmap(longs);
                        const sections = nbt.sections || nbt.Level?.Sections || nbt.Sections;
                        if (sections && sections.value) {
                            const sectionsMap = {};
                            for (const sec of sections.value) {
                                sectionsMap[Number(sec.Y)] = sec;
                            }

                            console.log(`Analyzing Chunk [${cx}, ${cz}]...`);
                            for (let z = 0; z < 4; z++) {
                                for (let x = 0; x < 4; x++) {
                                    // Height is stored relative to minimum height (-64)
                                    const Y = heights[z * 16 + x] - 1 - 64; 
                                    const secY = Math.floor(Y / 16);
                                    const yOffset = ((Y % 16) + 16) % 16;
                                    
                                    const sec = sectionsMap[secY];
                                    let blockName = 'minecraft:air';
                                    if (sec && sec.block_states) {
                                        const palette = sec.block_states.palette?.value || sec.block_states.palette;
                                        const data = sec.block_states.data;
                                        const index = yOffset * 256 + z * 16 + x;
                                        blockName = getBlockName(palette, data, index);
                                    }
                                    console.log(`Block at [x:${x}, y:${Y}, z:${z}]: ${blockName}`);
                                }
                            }
                            fs.closeSync(fd);
                            process.exit(0);
                        }
                    }
                }
            }
        }
    }
    fs.closeSync(fd);
}
