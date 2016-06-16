# Nestorbot Pull Requests

A custom bot application for [Slack](https://slack.com/) built with [Nestorbot](https://www.asknestor.me/) to show relevant organization issues and pull requests.


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

All commands must be directed to `@nestorbot`.


## Development

Nestorbot comes with a CLI tool for local development.

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
