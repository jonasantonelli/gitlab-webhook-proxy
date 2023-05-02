const bodyParser = require("body-parser");
const { Logtail } = require("@logtail/node");
const express = require("express");
const fetch = require("node-fetch");
const { stringify } = require("query-string");


const logtail = new Logtail("rA4PysGjttSy9F1hv3GabxBq");

const { REST_API, TOKEN } = process.env;

function getStatus(build) {
	switch (build.status) {
		case "FAILED":
			return {
				state: "failed",
				description: `Build ${build.number} has suffered a system error. Please try again.`
			};
		case "BROKEN":
			return {
				state: "failed",
				description: `Build ${build.number} failed to render.`,
			};
		case "DENIED":
			return {
				state: "failed",
				description: `Build ${build.number} denied.`,
			};
		case "PENDING":
			return {
				state: "pending",
				description: `Build ${build.number} has ${build.changeCount} changes that must be accepted`,
			};
		case "ACCEPTED":
			return {
				state: "success",
				description: `Build ${build.number} accepted.`,
			};
		case "PASSED":
			return {
				state: "success",
				description: `Build ${build.number} passed unchanged.`,
			};
	}

	return {
		context: "UI Tests",
	};
}

async function setCommitStatus(build, repoId) {
	const status = getStatus(build);

	logtail.info("build", build);
	logtail.info("status", status);

	logtail.flush();
	
	try {
		const queryString = stringify({
			context: "UI Tests",
			"target_url": build.webUrl,
			...status,
		});

		logtail.info(
			`POSTING to ${REST_API}projects/${repoId}/statuses/${build.commit}?${queryString}`
		);

		const result = await fetch(
			`${REST_API}projects/${repoId}/statuses/${build.commit}?${queryString}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${TOKEN}`,
				},
			}
		);

		logtail.info(result);
		logtail.info(await result.text());
		logtail.flush();
	} catch (e) {
		logtail.error(e.message);
		logtail.flush();
	}
}

const app = express();
app.use(bodyParser.json());

app.post("/webhook", async (req, res) => {
	const { event, build } = req.body;
	const { repoId } = req.query;

	if (!repoId) {
		const error = "Need a repoId query param on webhook URL";
		logtail.error(error);
		return res.status(400).send(error);
	}

	if (event === "build-status-changed") {
		await setCommitStatus(build, repoId);
	}

	res.end("OK");

});

const { PORT = 3000 } = process.env;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
