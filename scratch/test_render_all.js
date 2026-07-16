const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');

// Copy over NBTReader and unpackHeightmap / getBlockName / BLOCK_COLORS / getFallbackColor from index.js
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

function unpackHeightmap(longs) {
    if (!longs || longs.length < 37) return new Array(256).fill(0);
    const values = [];
    const bitsPerValue = 9;
    const mask = (1n << BigInt(bitsPerValue)) - 1n;
    const valPerLong = Math.floor(64 / bitsPerValue);

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

const BLOCK_COLORS = {
    'minecraft:grass_block': [94, 157, 52],
    'minecraft:dirt': [134, 96, 67]
};
function getFallbackColor() { return [100, 140, 80]; }

function getChunkNBT(mcaPath, chunkX, chunkZ) {
    let fd;
    try {
        if (!fs.existsSync(mcaPath)) return null;
        fd = fs.openSync(mcaPath, 'r');
        const offsetPos = 4 * (chunkX + chunkZ * 32);
        const header = Buffer.alloc(4);
        fs.readSync(fd, header, 0, 4, offsetPos);

        const offset = (header[0] << 16) | (header[1] << 8) | header[2];
        if (offset === 0) return null;

        const lengthBuf = Buffer.alloc(4);
        fs.readSync(fd, lengthBuf, 0, 4, offset * 4096);
        const length = lengthBuf.readUInt32BE(0);

        const meta = Buffer.alloc(1);
        fs.readSync(fd, meta, 0, 1, offset * 4096 + 4);
        const compressionType = meta[0];

        const compressedData = Buffer.alloc(length - 1);
        fs.readSync(fd, compressedData, 0, length - 1, offset * 4096 + 5);

        if (compressionType === 1) return zlib.gunzipSync(compressedData);
        if (compressionType === 2) return zlib.inflateSync(compressedData);
        return null;
    } catch (e) {
        return null;
    } finally {
        if (fd) fs.closeSync(fd);
    }
}

// Test rendering r.0.1.mca
const mcaPath = 'instances/781e7e70/world/region/r.0.1.mca';
console.log('Testing render of r.0.1.mca...');
try {
    const size = 512;
    const heightMap = new Array(size * size).fill(62);
    const colorMap = new Array(size * size).fill(null);

    for (let cz = 0; cz < 32; cz++) {
        for (let cx = 0; cx < 32; cx++) {
            const decompressed = getChunkNBT(mcaPath, cx, cz);
            if (!decompressed) continue;

            const reader = new NBTReader(decompressed);
            const nbt = reader.readTag().value;
            if (!nbt) continue;

            let heightmaps = nbt.Heightmaps || nbt.Level?.Heightmaps;
            if (heightmaps) {
                const longs = heightmaps.WORLD_SURFACE || heightmaps.MOTION_BLOCKING;
                if (longs) {
                    const unpacked = unpackHeightmap(longs);
                    const sections = nbt.sections || nbt.Level?.Sections || nbt.Sections;
                    const sectionsMap = {};
                    if (sections && sections.value) {
                        for (const sec of sections.value) {
                            sectionsMap[Number(sec.Y)] = sec;
                        }
                    }

                    for (let z = 0; z < 16; z++) {
                        for (let x = 0; x < 16; x++) {
                            const globalX = cx * 16 + x;
                            const globalZ = cz * 16 + z;
                            const indexInMap = globalZ * size + globalX;

                            const rawH = unpacked[z * 16 + x];
                            const hasNegativeSections = Object.keys(sectionsMap).some(y => parseInt(y, 10) < 0);
                            const Y = rawH - 1 - (hasNegativeSections ? 64 : 0);

                            heightMap[indexInMap] = Y;

                            let finalColor = [46, 110, 203];
                            for (let depth = 0; depth < 16; depth++) {
                                const currentY = Y - depth;
                                if (currentY < -64) break;

                                const secY = Math.floor(currentY / 16);
                                const yOffset = ((currentY % 16) + 16) % 16;
                                const sec = sectionsMap[secY];
                                if (sec && sec.block_states) {
                                    const palette = sec.block_states.palette?.value || sec.block_states.palette;
                                    const data = sec.block_states.data;
                                    const idx = yOffset * 256 + z * 16 + x;
                                    const blockName = getBlockName(palette, data, idx);

                                    if (blockName !== 'minecraft:air' && blockName !== 'minecraft:cave_air' && blockName !== 'minecraft:void_air') {
                                        const c = BLOCK_COLORS[blockName] || getFallbackColor(blockName);
                                        if (c) {
                                            finalColor = c;
                                            break;
                                        }
                                    }
                                }
                            }
                            colorMap[indexInMap] = finalColor;
                        }
                    }
                }
            }
        }
    }
    console.log('Successfully completed rendering simulation of r.0.1.mca!');
} catch (err) {
    console.error('Render error:', err);
}
