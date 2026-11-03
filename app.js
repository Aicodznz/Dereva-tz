// cPanel / Phusion Passenger Entrypoint for Rodline Hosting & Production Servers
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./dist/server.cjs');
