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
                this.offset += 2;
                return 0;
            }
            case 3: {
                const i = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                return i;
            }
            case 4: {
                // Keep as BigInt or read normal
                const l = this.buffer.readBigInt64BE(this.offset);
                this.offset += 8;
                return l;
            }
            case 5: {
                this.offset += 4;
                return 0;
            }
            case 6: {
                this.offset += 8;
                return 0;
            }
            case 7: {
                const len = this.buffer.readInt32BE(this.offset);
                this.offset += 4 + len;
                return null;
            }
            case 8: {
                const strLen = this.buffer.readUInt16BE(this.offset);
                this.offset += 2 + strLen;
                return '';
            }
            case 9: {
                const elemType = this.buffer[this.offset++];
                const listLen = this.buffer.readInt32BE(this.offset);
                this.offset += 4;
                if (elemType === 10) {
                    const list = [];
                    for (let k = 0; k < listLen; k++) {
                        list.push(this.readValue(elemType));
                    }
                    return { type: elemType, value: list };
                } else {
                    // Skip scalar lists quickly
                    const skipSizes = { 1:1, 2:2, 3:4, 4:8, 5:4, 6:8, 8:2 };
                    if (elemType === 8) {
                        for (let k = 0; k < listLen; k++) {
                            const len = this.buffer.readUInt16BE(this.offset);
                            this.offset += 2 + len;
                        }
                    } else {
                        const size = skipSizes[elemType] || 0;
                        this.offset += listLen * size;
                    }
                    return { type: elemType, value: [] };
                }
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
                const len = this.buffer.readInt32BE(this.offset);
                this.offset += 4 + len * 4;
                return [];
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

// Unpack Long Array for heightmap values (9 bits per value, 256 values total)
function unpackHeightmap(longs) {
    const values = [];
    const bitsPerValue = 9;
    const mask = (1n << BigInt(bitsPerValue)) - 1n;
    let currentLongIdx = 0;
    let currentBitOffset = 0;

    for (let i = 0; i < 256; i++) {
        let val = 0n;
        const longVal = BigInt(longs[currentLongIdx]);
        if (currentBitOffset + bitsPerValue <= 64) {
            val = (longVal >> BigInt(currentBitOffset)) & mask;
            currentBitOffset += bitsPerValue;
            if (currentBitOffset === 64) {
                currentBitOffset = 0;
                currentLongIdx++;
            }
        } else {
            const part1Bits = 64 - currentBitOffset;
            const part2Bits = bitsPerValue - part1Bits;
            const val1 = (longVal >> BigInt(currentBitOffset)) & ((1n << BigInt(part1Bits)) - 1n);

            currentLongIdx++;
            if (currentLongIdx < longs.length) {
                const nextLongVal = BigInt(longs[currentLongIdx]);
                const val2 = nextLongVal & ((1n << BigInt(part2Bits)) - 1n);
                val = val1 | (val2 << BigInt(part1Bits));
            } else {
                val = val1;
            }
            currentBitOffset = part2Bits;
        }
        values.push(Number(val));
    }
    return values;
}

// Find a generated chunk in the region file r.0.0.mca
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
                // Found generated chunk!
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
                        console.log(`Chunk [${cx}, ${cz}] heights:`, heights.slice(0, 16));
                        fs.closeSync(fd);
                        process.exit(0);
                    }
                }
            }
        }
    }
    fs.closeSync(fd);
} else {
    console.log('Region file not found.');
}
