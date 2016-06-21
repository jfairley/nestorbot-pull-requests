# Nestorbot Pull Requests

A custom bot application for [Slack](https://slack.com/) built with [Nestorbot](https://www.asknestor.me/) to show relevant organization issues and pull requests.

## What It Does

This bot script fetches all open Github issues and pull requests for the levelsbeyond organization using the [Github APIs](https://developer.github.com/v3/issues/#list-issues). It parses each issue for relevant "snippets" of text and messages back to you any matches. Think of it like piping to `grep`.

### What is a Snippet?

A "snippet" is simply a piece of text.

### What is a Team?

A "team" a grouping of snippets. You can create a team for yourself (see `User Commands`) or for your team (see `Team Commands`).

### How Do I Use It?

You can interact with nestorbot directly by sending a direct message in Slack to `nestorbot`. Alternatively, within a channel, you can tag `@nestorbot` in your command. Just be sure to invite `nestorbot` to the channel.

If you want to experiment, try out any of the commands as a direct message to `nestorbot`. Nothing is permanent, and you won't break it. :wink:


## Bot Usage (in Slack)

- `pulls help` - display this message

### User Commands

- `pulls` - show all issues and pull-requests based on the snippets defined for the current user
- `pulls details` - show the snippets for the current user
- `pulls username <github-username>` - regiseter a github username for the current user
- `pulls add snippet foo` - add "foo" as a snippet for the current user
- `pulls remove snippet foo` - remove "foo" as a snippet for the current user

### Team Commands

- `pulls list` - show all teams
- `pulls my-team` - show all issues and pull-requests based on the snippets defined as "my-team"
- `pulls add team my-team` - add a team called "my-team"
- `pulls remove team my-team` - remove a team called "my-team"
- `pulls rename team my-team to my-new-team` - rename a team called "my-team" to "my-new-team"
- `pulls details my-team` - show the snippets for "my-team"
- `pulls add snippet foo to my-team` - add "foo" as a snippet for "my-team"
- `pulls remove snippet foo from my-team` - remove "foo" as a snippet for "my-team"

All commands must be directed to `@nestorbot` when used in a channel.


## Development

Nestorbot works just like any Node application. It comes with a CLI tool for local development. Contributions welcome!

```sh
# install
brew install nestor

# save bot
nestor save

# test bot
nestor shell

# deploy bot
nestor deploy --latest
```

Nestorbot Repository and Programming Manual: https://github.com/zerobotlabs/nestorbot
