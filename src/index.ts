//@ts-ignore
const hasValidHeader = (request, env) => {
	return request.headers.get("X-Custom-Auth-Key") === env.AUTH_KEY_SECRET;
  };

//@ts-ignore
function handleCors(request) {
	const headers = new Headers();
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type, X-Custom-Auth-Key");
	return headers;
}

//@ts-ignore
function authorizeRequest(request, env) {
	switch (request.method) {
	  case "PUT":
	  case "DELETE":
		return hasValidHeader(request, env);
	  case "GET":
		return false;
	  default:
		return false;
	};
};

export default {
	async fetch(request, env) {
	  const key = crypto.randomUUID();

	  if (request.method === "OPTIONS") {
		return new Response(null, {
		  status: 204,
		  headers: handleCors(request),
		});
	  }

	  if (!authorizeRequest(request, env)) {
		return new Response("Forbidden", { status: 403, headers: handleCors(request) });
	  }
  
	  switch (request.method) {
		case "PUT":
			const contentLength = request.headers.get("Content-Length");
			if (contentLength && parseInt(contentLength) > 25 * 1024 * 1024) {
				return new Response("Payload Too Large", { status: 413, headers: handleCors(request) });
				}

			const fileName = new URL(request.url).pathname.slice(1);
			await env.MY_BUCKET.put(key, request.body, { customMetadata: { fileName: fileName || '' } });
			return new Response(JSON.stringify({ 
				"status": "success",
				"key": key,
				"download_url": `${new URL(request.url).origin}/${key}`
			}), { headers: handleCors(request) });
		case "GET":
		  const object = await env.MY_BUCKET.get(key);

		  if (object === null) {
			return new Response("Object Not Found", { status: 404, headers: handleCors(request) });
		  }

		  const headers = handleCors(request);
		  object.writeHttpMetadata(headers);
		  headers.set("etag", object.httpEtag);
  
		  return new Response(object.body, {
			headers: headers,
		  });

		default:
		  return new Response("Method Not Allowed", {
			status: 405,
			headers: {
			  ...handleCors(request),
			  Allow: "PUT, GET",
			},
		  });
	  }
	},
} satisfies ExportedHandler<Env>;
