var Promise = require('bluebird');
var _ = require('lodash');


module.exports = function (robot) {
    const actions = [
        {pattern: /^details$/i, callback: details},
        {pattern: /^add team (.*)/i, callback: newTeam},
        {pattern: /^new team (.*)/i, callback: newTeam},
        {pattern: /^delete team (.*)/i, callback: removeTeam},
        {pattern: /^remove team (.*)/i, callback: removeTeam},
        {pattern: /^rename team (.*) to (.*)/i, callback: renameTeam},
        {pattern: /^details (.*)/i, callback: teamDetails},
        {pattern: /^add snippet (.*) to (.*)/i, callback: addSnippet},
        {pattern: /^new snippet (.*) to (.*)/i, callback: addSnippet},
        {pattern: /^delete snippet (.*) from (.*)/i, callback: removeSnippet},
        {pattern: /^remove snippet (.*) from (.*)/i, callback: removeSnippet},
        {pattern: /^(.*)/i, callback: listPRs}
    ];


    robot.respond(/(pulls|prs) (.*)/i, (msg, done) => {
        var pattern = msg.match[2];
        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];
            var matches = action.pattern.exec(pattern);
            if (matches) {
                return action.callback.apply(null, _.flatten([msg, done, _.slice(matches, 1)]));
            }
        }

        msg.send('Error: Unknown command', done);
    });

    /**
     * search for PRs
     */
    function listPRs(msg, done, team) {
        const snippets = robot.brain.get(team);
        if (!Array.isArray(snippets)) {
            return teamDoesNotExist(msg, team, done);
        }
        return fetchOrgIssues(robot)
            .then(
                body => {
                    var grouping = groupByRepositoryUrl(body);
                    return _.map(grouping, group => {
                            var links = bodyToLinks(group, snippets);
                            if (_.isEmpty(links)) {
                                return '';
                            }

                            return `*${group[0].repository.name}*\n${
                                links
                                    .map(link => ` - ${link}`)
                                    .join('\n')
                                }`;
                        })
                        .filter(message => message.length)
                        .join('\n');
                },
                err => err
            )
            .then(message => _.isEmpty(message) ? `no PRs!! you're in the clear` : message)
            .then(message => msg.send(message, done))
            .catch(err => msg.send(`Unhandled error:\n${err}`, done));
    }

    /**
     * show details for the bot
     */
    function details(msg, done) {
        const teams = robot.brain.data._private;
        msg.send(`Configured teams:\n${_.keys(teams).map(key => ` - ${key}`).join('\n')}`, done);
    }

    /**
     * create a new team
     */
    function newTeam(msg, done, team) {
        if (Array.isArray(robot.brain.get(team))) {
            return msg.send(`Error: Team already exists. See \`${msg.match[1]} details ${team}\`.`, done);
        }

        robot.brain.set(team, []);
        msg.send(`Created team: ${team}!`, done);
    }

    /**
     * delete a team
     */
    function removeTeam(msg, done, team) {
        robot.brain.set(team, undefined);
        msg.send(`Removed team: ${team}!`, done);
    }

    /**
     * rename a team
     */
    function renameTeam(msg, done, oldTeam, newTeam) {
        var snippets = robot.brain.get(oldTeam);
        if (Array.isArray(snippets)) {
            return msg.send(`Error: Team already exists. See \`${msg.match[1]} details ${oldTeam}\`.`, done);
        }

        robot.brain.set(newTeam, snippets);
        robot.brain.set(oldTeam, undefined);
        msg.send(`Renamed team ${oldTeam} to ${newTeam}!`, done);
    }

    /**
     * show details for a list of snippets
     */
    function teamDetails(msg, done, team) {
        const snippets = robot.brain.get(team);
        if (!Array.isArray(snippets)) {
            return teamDoesNotExist(msg, team, done)
        }

        msg.send(`Details for ${team}:\n${snippets.map(snippet => ` - ${snippet}`).join('\n')}`, done);
    }

    /**
     * add a snippet to a team
     */
    function addSnippet(msg, done, newSnippet, team) {
        const snippets = robot.brain.get(team);
        if (!Array.isArray(snippets)) {
            return teamDoesNotExist(msg, team, done);
        }

        robot.brain.set(team, _.uniq(_.flatten([snippets, newSnippet])));
        msg.send(`Added ${newSnippet} to ${team}!`, done);
    }

    /**
     * remove a snippet from a team
     */
    function removeSnippet(msg, done, removedSnippet, team) {
        const snippets = robot.brain.get(team);
        if (!Array.isArray(snippets)) {
            return teamDoesNotExist(msg, team, done);
        }

        robot.brain.set(team, _.without(snippets, removedSnippet));
        msg.send(`Removed ${removedSnippet} from ${team}!`, done);
    }
};

function teamDoesNotExist(msg, team, done) {
    return msg.send(`Error: Team does not exist. See \`${msg.match[1]} new team ${team}\`.`, done);
}

/**
 * Fetch organization issues
 * @param robot
 */
function fetchOrgIssues(robot) {
    var deferred = Promise.defer();
    robot.http('https://api.github.com/orgs/levelsbeyond/issues?filter=all')
        .header('Authorization', `token ${process.env.HUBOT_GITHUB_TOKEN}`)
        .get()(function (err, res, body) {
            if (err) {
                deferred.reject(err);
            } else {
                var parsedBody = JSON.parse(body);
                if (!Array.isArray(parsedBody)) {
                    deferred.reject('Error from fetching issues:\n```\n' + body + '\n```');
                } else {
                    deferred.resolve(parsedBody);
                }
            }
        });
    return deferred.promise;
}

/**
 * return sorted array of arrays
 * @param pulls
 */
function groupByRepositoryUrl(pulls) {
    pulls = _.sortBy(pulls, 'repository_url');
    return _.groupBy(pulls, 'repository_url');
}

/**
 * filter and convert array of pull objects to link
 * @param body
 * @param snippets
 * @returns {Array}
 */
function bodyToLinks(body, snippets) {
    return body
        .filter(resp =>
            snippets.some(snippet =>
                -1 < resp.title.indexOf(snippet)
                || -1 < resp.body.indexOf(snippet)
                || _.isEqual(_.get(resp, 'assignee.login'), _.trim(snippet, ' @'))
                || _.isEqual(_.get(resp, 'user.login'), _.trim(snippet, ' @'))
            )
        )
        .map(respToLink);
}

/**
 * convert a single pull object to a link
 * @param resp
 * @returns {string}
 */
function respToLink(resp) {
    const link = `<${resp.html_url}|${resp.title}>`;
    const extras = [
        // PR or Issue?
        `${_.isObject(resp.pull_request) ? 'PR' : 'issue'} -> ${resp.user.login}`
    ];
    // has assignee?
    if (_.isObject(resp.assignee)) {
        extras.push(`assigned to ${resp.assignee.login}`);
    }
    // format string
    return `${link} (${extras.join(', ')})`;
}
