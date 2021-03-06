module.exports = function () {
    this.on('registered', function (network, msg) {
        var modes = this.config.get('plugins.modes.' + network, []);
        if (typeof modes == 'string') modes = [modes];
        modes.forEach(function (mode) {
            this.log('Setting mode on %s:', network, mode);
            this.sendRaw(network, 'MODE', this.networks[network].nick, mode);
        }, this);
    });
};
