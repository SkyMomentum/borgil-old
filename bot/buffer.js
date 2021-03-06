var default_buffer = 100;

module.exports = function () {
    // Create buffer objects for each client.
    this.buffers = {};
    for (network in this.clients) {
        this.buffers[network] = {};
    }

    // Log each message to a buffer.
    this.on('message', function (network, nick, target, text, msg) {
        var source = target == this.clients[network].nick ? nick : target;

        // Initialize buffer for this source if necessary.
        if (!(source in this.buffers[network])) {
            this.buffers[network][source] = [];
        }
        var buffer = this.buffers[network][source];

        // Trim buffer to maximum length, then add this message.
        if (buffer.length >= this.config.get('buffer', default_buffer)) {
            buffer.pop();
        }
        buffer.unshift({
            nick: nick,
            text: text,
            time: Date.now(),
        });
    });
};
