//@ts-ignore
const hasValidHeader = (request, env) => {
	return request.headers.get("X-Custom-Auth-Key") === env.AUTH_KEY_SECRET;
  };

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

	  if (!authorizeRequest(request, env)) {
		return new Response("Forbidden", { status: 403 });
	  }
  
	  switch (request.method) {
		case "PUT":
			const contentLength = request.headers.get("Content-Length");
			if (contentLength && parseInt(contentLength) > 25 * 1024 * 1024) {
				return new Response("Payload Too Large", { status: 413 });
			}
		  await env.MY_BUCKET.put(key, request.body);
		  return new Response(JSON.stringify({ 
			"status": "success",
			"key": key,
			"download_url": `https://r2-worker.nergis.workers.dev/${key}`
		   }));
		case "GET":
		  const object = await env.MY_BUCKET.get(key);

		  if (object === null) {
			return new Response("Object Not Found", { status: 404 });
		  }
  
		  const headers = new Headers();
		  object.writeHttpMetadata(headers);
		  headers.set("etag", object.httpEtag);
  
		  return new Response(object.body, {
			headers,
		  });

		default:
		  return new Response("Method Not Allowed", {
			status: 405,
			headers: {
			  Allow: "PUT, GET",
			},
		  });
	  }
	},
} satisfies ExportedHandler<Env>;
