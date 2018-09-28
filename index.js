const fs = require('fs');
const BSON = require('bson');
const path = require('path');
const db_path = path.join(__dirname, './ip.db');
const mongo = require(path.join(__dirname, './mongo'))();

module.exports = ipInfo = function ipInfo() {
    const TOTAL_BLOCK_LENGTH = 2;
    const INDEX_BLOCK_LENGTH = 5;

    const ip = {};

    ip.init = function () {
        this.fd = fd = fs.openSync(db_path, 'r');
        let buf = Buffer.alloc(TOTAL_BLOCK_LENGTH);
        fs.readSync(fd, buf, 0, TOTAL_BLOCK_LENGTH, 0);
        this.TOTAL = TOTAL = buf.readUInt16BE(0);
        this.bson = new BSON();
    };

    ip.getInfoByIndex = function (index) {
        let index_block_buf = Buffer.alloc(INDEX_BLOCK_LENGTH);
        fs.readSync(this.fd, index_block_buf, 0, INDEX_BLOCK_LENGTH, index * INDEX_BLOCK_LENGTH + TOTAL_BLOCK_LENGTH);
        let offset = index_block_buf.readUInt32BE(0);
        let length = index_block_buf.readUInt8(4);

        let data_block_buf = Buffer.alloc(length);
        fs.readSync(this.fd, data_block_buf, 0, length, offset);
        let data = this.bson.deserialize(data_block_buf);
        return data;
    };

    ip.numify = function (_ip) {
        const ips = _ip.split('.');
        const res = ips[0] * Math.pow(10, 9) +
            ips[1] * Math.pow(10, 6) +
            ips[2] * Math.pow(10, 3) +
            ips[3] * Math.pow(10, 0);
        return res;
    };

    ip.binarySearch = function (ip) {
        let target = this.numify(ip);
        let high = this.TOTAL - 1, low = 0, mid = 0, info;
        while (low <= high) {
            mid = (low + high) >> 1;
            info = this.getInfoByIndex(mid);
            if (target > info.eip) low = mid + 1;
            else if (target < info.sip) high = mid - 1;
            else break;
        }
        return info;
    };

    ip.creatDbFile = async function () {
        var { err, data: db } = await mongo.init();
        if (err) return console.log(err);
        var { err, data } = await mongo.find.toArray('ipCity', {}, {
            raw: true,
            // limit: 2,
        });
        if (err) return console.log(err);

        const bufferArray = [];
        ip.dataLength = dataLength = data.length;
        let total_buf = Buffer.alloc(TOTAL_BLOCK_LENGTH);
        total_buf.writeUInt16BE(dataLength, 0);
        bufferArray[0] = total_buf;

        let offset = TOTAL_BLOCK_LENGTH + INDEX_BLOCK_LENGTH * ip.dataLength;
        for (let i = 0; i < dataLength; i++) {
            let length = data[i].length;
            let index_block_buf = Buffer.alloc(INDEX_BLOCK_LENGTH);
            index_block_buf.writeUInt32BE(offset, 0);
            index_block_buf.writeUInt8(length, 4);
            bufferArray[1 + i] = index_block_buf;
            offset += length;

            let data_block_buf = Buffer.alloc(length, data[i]);
            bufferArray[1 + ip.dataLength + i] = data_block_buf;
        }

        let buffer = Buffer.concat(bufferArray);
        fs.writeFileSync(db_path, buffer);
        console.log(db_path, 'write over:', dataLength, buffer.length);
    }

    return ip;
}

// const ip = ipInfo();
// ip.init();
// const res = ip.binarySearch('10.12.1.1');
// console.log(res);