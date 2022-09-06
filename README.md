# Joe's Socket To Interface Utility
This utility is to help discover a common interface from object sent over
a websocket pipe.

## How It Works
The program discovers the shape of incoming messages, takes a hash of their
shape, and then stores the individual shapes to be processed by the 
[json-to-ts] utility. The program will accumulate all data in the directory
named `files` relative to whatever directory you execute from.

The `files` directory structure is as follows.

  * `files/interfaces`: contains the resulting `index.d.ts` interface.
  * `files/stats.json`: contains stats about what has been processed thus far.
  * `files/raw/<hash>.json`: contains the raw file that created a corresponding
    shape.
  * `files/shapes/<hash>.json`: contains the shapes generated from the
    corresponding raw messages.

## Install
Check out the project and run:
`npm install -g`

## Running
Choose a directory where you want the files to be saved and start the script.

`socket-to-interface wss://ws.backpack.tf/events`

Hit `CTRL-C` to exit and process the files.

If you accumulate a ton of samples, be patient as it'll take a while to
generate the interface. Check `files/interfaces/index.d.ts` for the result.

## About Me
I made this in my spare time and I hope you find it useful. Look me up on
any of the following social networks:

* [twitter: @joekiller]
* [steam: joekiller]
* [joekiller.com]
* [LinkedIn: Joseph Lawson]

Please understand I will not offer any support outside GitHub issues and I
make no promises to attend to those either. Happy coding!

## End

[twitter: @joekiller]: https://twitter.com/joekiller
[steam: joekiller]: https://steamcommunity.com/id/joekiller/
[joekiller.com]: https://joekiller.com
[LinkedIn: Joseph Lawson]: https://www.linkedin.com/in/joseph-lawson
[ws]: https://github.com/websockets/ws
