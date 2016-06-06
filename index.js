var Promise = require('bluebird');
var _ = require('lodash');


module.exports = function (robot) {
    const actions = [
        {pattern: /add team (.*)/i, callback: newTeam},
        {pattern: /new team (.*)/i, callback: newTeam},
        {pattern: /delete team (.*)/i, callback: removeTeam},
        {pattern: /remove team (.*)/i, callback: removeTeam},
        {pattern: /details (.*)/i, callback: teamDetails},
        {pattern: /add snippet (.*) to (.*)/i, callback: addSnippet},
        {pattern: /new snippet (.*) to (.*)/i, callback: addSnippet},
        {pattern: /delete snippet (.*) from (.*)/i, callback: removeSnippet},
        {pattern: /remove snippet (.*) from (.*)/i, callback: removeSnippet},
        {pattern: /(.*)/i, callback: listPRs}
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
    function listPRs(msg, done, list) {
        const snippets = robot.brain.get(list);
        if (!Array.isArray(snippets)) {
            return listDoesNotExist(msg, list, done);
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
     * create a new list of snippets
     */
    function newTeam(msg, done, list) {
        if (Array.isArray(robot.brain.get(list))) {
            return msg.send(`Error: List already exists. See \`${msg.match[1]} details ${list}\`.`, done);
        }

        robot.brain.set(list, []);
        msg.send(`Created list: ${list}!`, done);
    }

    /**
     * delete a list of snippets
     */
    function removeTeam(msg, done, list) {
        robot.brain.set(list, undefined);
        msg.send(`Removed list: ${list}!`, done);
    }

    /**
     * show details for a list of snippets
     */
    function teamDetails(msg, done, list) {
        const snippets = robot.brain.get(list);
        if (!Array.isArray(snippets)) {
            return listDoesNotExist(msg, list, done)
        }

        msg.send(`Details for ${list}:\n${JSON.stringify(snippets, null, 2)}`, done);
    }

    /**
     * add a snippet to a list
     */
    function addSnippet(msg, done, newSnippet, list) {
        const snippets = robot.brain.get(list);
        if (!Array.isArray(snippets)) {
            return listDoesNotExist(msg, list, done);
        }

        robot.brain.set(list, _.uniq(_.flatten([snippets, newSnippet])));
        msg.send(`Added ${newSnippet} to ${list}!`, done);
    }

    /**
     * remove a snippet from a list
     */
    function removeSnippet(msg, done, removedSnippet, list) {
        const snippets = robot.brain.get(list);
        if (!Array.isArray(snippets)) {
            return listDoesNotExist(msg, list, done);
        }

        robot.brain.set(list, _.without(snippets, removedSnippet));
        msg.send(`Removed ${removedSnippet} from ${list}!`, done);
    }
};

function listDoesNotExist(msg, list, done) {
    return msg.send(`Error: List does not exist. See \`${msg.match[1]} new list ${list}\`.`, done);
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
        .filter(resp => snippets
            .some(snippet => -1 < resp.body.indexOf(snippet)))
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
