var Promise = require('bluebird');
var _ = require('lodash');


module.exports = function (robot) {
    const actions = [
        {pattern: /^$/i, callback: listPRsForUser},
        {pattern: /^ list$/i, callback: listTeams},
        {pattern: /^ add team (.*)$/i, callback: newTeam},
        {pattern: /^ new team (.*)$/i, callback: newTeam},
        {pattern: /^ username (.*)$/i, callback: newTeamForUser},
        {pattern: /^ delete team (.*)$/i, callback: removeTeam},
        {pattern: /^ remove team (.*)$/i, callback: removeTeam},
        {pattern: /^ rename team (.*) to (.*)$/i, callback: renameTeam},
        {pattern: /^ details (.*)$/i, callback: teamDetails},
        {pattern: /^ details$/i, callback: teamDetailsForUser},
        {pattern: /^ add snippet (.*) to (.*)$/i, callback: addSnippet},
        {pattern: /^ add snippet (.*)$/i, callback: addSnippetForUser},
        {pattern: /^ new snippet (.*) to (.*)$/i, callback: addSnippet},
        {pattern: /^ new snippet (.*)$/i, callback: addSnippetForUser},
        {pattern: /^ delete snippet (.*) from (.*)$/i, callback: removeSnippet},
        {pattern: /^ delete snippet (.*)$/i, callback: removeSnippetForUser},
        {pattern: /^ remove snippet (.*) from (.*)$/i, callback: removeSnippet},
        {pattern: /^ remove snippet (.*)$/i, callback: removeSnippetForUser},
        {pattern: /^ (.*)$/i, callback: listPRs}
    ];


    robot.respond(/(pulls|prs)(.*)/i, (msg, done) => {
        var pattern = msg.match[2];
        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];
            var matches = action.pattern.exec(pattern);
            if (matches) {
                return action.callback.apply(null, _.flatten([msg, done, _.slice(matches, 1)]));
            }
        }

        msg.send('Error: Unknown command `' + msg.message.text + '`', done);
    });

    /**
     * search for PRs for the current user
     */
    function listPRsForUser(msg, done) {
        const userId = getUserId(msg);
        const snippets = robot.brain.get(userId);
        if (!Array.isArray(snippets)) {
            return provideUsername(msg, done);
        }

        return listPRs(msg, done, userId);
    }

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
     * show configured teams
     */
    function listTeams(msg, done) {
        const teams = robot.brain.data._private;
        msg.send(`Configured teams:\n${_.keys(teams).map(key => ` - ${key}`).join('\n')}`, done);
    }

    /**
     * create a team for the current user and add the github username as a snippet
     */
    function newTeamForUser(msg, done, snippet) {
        const userId = getUserId(msg);
        const snippets = robot.brain.get(userId) || [];
        robot.brain.set(userId, flatten(snippets, snippet));
        return msg.send(`Github username registered: \`${snippet}\`! From now on, just type \'pulls\' to see your issues.`)
            .then(function () {
                return listPRsForUser(msg, done);
            });
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
     * show details for the current user
     */
    function teamDetailsForUser(msg, done) {
        const userId = getUserId(msg);
        const snippets = robot.brain.get(userId);
        if (!Array.isArray(snippets)) {
            return provideUsername(msg, done);
        }

        msg.send(`Details:\n${snippets.map(snippet => ` - ${snippet}`).join('\n')}`, done);
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
     * add a snippet for the current user
     */
    function addSnippetForUser(msg, done, newSnippet) {
        const userId = getUserId(msg);
        const snippets = robot.brain.get(userId);
        if (!Array.isArray(snippets)) {
            return provideUsername(msg, done);
        }

        robot.brain.set(userId, flatten(snippets, userId));
        msg.send(`Added ${newSnippet}!`, done);
    }

    /**
     * add a snippet to a team
     */
    function addSnippet(msg, done, newSnippet, team) {
        const snippets = robot.brain.get(team);
        if (!Array.isArray(snippets)) {
            return teamDoesNotExist(msg, team, done);
        }

        robot.brain.set(team, flatten(snippets, newSnippet));
        msg.send(`Added ${newSnippet} to ${team}!`, done);
    }

    /**
     * remove a snippet for the current user
     */
    function removeSnippetForUser(msg, done, removedSnippet) {
        const userId = getUserId(msg);
        const snippets = robot.brain.get(userId);
        if (!Array.isArray(snippets)) {
            return provideUsername(msg, done);
        }

        robot.brain.set(userId, _.without(snippets, removedSnippet));
        msg.send(`Removed ${removedSnippet}!`, done);
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

/**
 * get the ID of the user sending the message
 */
function getUserId(msg) {
    return msg.message.user.id;
}

function provideUsername(msg, done) {
    return msg.send(`Please provide your username: \`pulls username <github username>\``, done);
}

function teamDoesNotExist(msg, team, done) {
    return msg.send(`Error: Team does not exist. See \`${msg.match[1]} new team ${team}\`.`, done);
}

function flatten() {
    return _.uniq(_.flatten(arguments));
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
