

adjust favicon

allow user to end audio early

pull files from modal (etst our api key)

create integration tests vs end to end tests with playwright

(can you explain integration vs e2e tests in a doc?)

(nice countdown timer / some sort of illustration)

scaffold openrouter API to process transcription once modal is done

Modal once mentioned agent in sandbox, agent controlling sandbox paradigm: 


your application. So maybe you have um different users have different repos
23:36
that they're accessing. Um you probably wouldn't want to create an image for each of those. Uh just kind of as a a
23:42
matter of ergonomics. It's it's sort of easier to think about those as volumes. Um whereas if you want to if
23:50
you have data that is going to be in every sandbox and an image makes a lot of sense. So um at at the end of the day
23:57
like a lot of this the primitives the underlying kind of things that are happening on our file system uh do look
24:05
pretty similar between volumes and images and snapshots but um I think of
24:10
them as just sort of different semantics around uh using those where image is
24:16
I think of as less sort of specific to a user. it's just sort of your more the
24:22
application code or data that your application always needs uh as opposed to user data.
24:28
I guess we can share a little bit more specifics also on sort of how others typically do this. So on like a vibe
24:33
coding platform the typical setup would be that you have snapshots that are keyed by the end user. Uh so when the
24:38
the same end user come back comes back you want to restore from that snapshot associated with that user and their or
24:44
their particular project actually probably rather than user. Um meaning it
24:49
probably doesn't make sense for you to build one image for every one of your users or every one of your users projects. That's very many. Um but it
24:56
makes sense to have something that's basically keyed by the user or user's projects. Um ramp uh they write about
25:03
this in their blog post which is a very good one by the way. So you should read that one. um they uh use snapshots a
25:09
little bit differently. They basically build snapshots every 30 minutes uh from their repos. So they have a bunch of
25:15
repos that they use uh inspect on and for each of those they rebuild a new uh it's I mean it is basically an image
25:22
when you take a snapshot the resulting artifact is an image but they do it using the snapshots mechanism. Uh and
25:27
this is to minimize the amount of work that needs to happen when you start the sandbox. So there needs to also be a git
25:32
pull that basically pulls the latest changes into the sandbox. everything that has happened since that thing that
25:38
can be at most uh the last snapshot which can be at most 30 minutes old. Um but by doing it kind of frequently that
25:45
means there's not too much work to do there. There's not too much to pull and that kind of helps keep startup latency
25:50
lower. So there it's basically keyed by the repository and a time stamp
25:56
but it's it varies sort of exactly how people use these.
26:02
Um cool. Next question. Um, what are your security concerns with agents running inside the sandbox if for
26:08
example an LLM provider credentials if LLM provider credentials are injected via proxy?
26:15
So yeah, so this is one that kind of I'll go back to this uh sort of architecture slide. So this comes up
26:22
more in this case where you're running an agent inside the sandbox. Um which is
26:29
I guess you know it it has some fundamental problems for the same reason
26:34
that running cloud code anywhere has fundamental problems in that the
26:41
the kind of the code that the agent is running um isn't necessarily isolated
26:46
from the environment that it's running in. uh Anthropic has been working hard I
26:52
think on on kind of creating their a layer of isolation so that the code run
26:59
by the sandbox is sort of contained but um in general with these kind of coding
27:05
agent harnesses and this is a problem whether you're running it locally or in a sandbox it's
27:10
it's essentially the same thing is that it has access to the API tokens um that
27:16
you're using um so one approach to this is to go through a proxy. Um, which I
27:21
think the question kind of alluded to, like you could have the agent call out to a proxy with a temporary credential,
27:27
that proxy could replace that temporary credential um with the real thing. Uh,
27:33
and that way if the agent had some bad instructions, bad prompt, um, it
27:39
couldn't actually exfiltrate that. Um, but this is generally where like if this
27:45
is a big concern for you, I think that the approach of sort of having the agent
27:51
harness run outside of the sandbox is really the approach I'd recommend. I think it's like the kind of the
27:56
long-term direction that things are going to go. And I think right now it's just sort of because these agents are in
28:03
their infancy, we haven't sort of seen that separation take place yet.
28:10
Uh, cool. Uh another question uh what makes bodal so much faster than say I
28:15
think this uh EC2 yeah so with EC2 you're like waiting on
28:22
them to provision the VM and it's uh you know I think it's traditionally
28:29
not something that they've expected you to do from within an application like you're you're expected to start EC2
28:36
instances from infrastructure code and infrastructure code is is generally not
28:42
like waiting on a human. It's not it doesn't need to be fast. You're expected to be running, you know, this EC2
28:48
instance potentially for months or or years even. Um like these are kind of
28:55
long running instances where whether they can start up in 2 seconds or 45
29:00
seconds is not really a big difference to the users of EC2. Um with us what
29:06
what you're getting is um we provision with a lot of overhead so that we can
29:14
very quickly sort of just have a fast scheduler decide where to run your your
29:19
code uh where to run your sandbox where there's capacity for the memory that you
29:24
request and the CPU you request and then we can you know we've optimized the
29:30
system to make that process very fast because our customers are calling this
29:35
code from application code and so um you know we we recognize that it needs to be
29:41
fast so I think it's partly priorities partly sort of the technical infrastructure of how they do things
29:49
cool um do you have any examples of what kind of uh development directory
29:56
snapshots enables that was not possible with the old tools and I can take this one I think if we go back to the lovable
30:02
architecture slide um I can try to make it my answer specific. Um, so let's say
30:09
this is your setup. You're building a VIP coding platform. Uh, a common scenario here would be you have this uh
30:14
demon that's running inside this sandbox. So this is basically lovables logic in this case. You want to make some updates. This you want it to work
30:21
differently. You're changing something about how this works. Um, if you have previously taken a bunch of entire file
30:27
system snapshots of every single user project that has ever been run on the platform, as soon as you're making this
30:32
change, you have to throw all of them away. none of them are up to date anymore. And so now suddenly instead of
30:37
restoring from these snapshots when these users come back, you're going to have to start from scratch and build their entire environment and do all of
30:44
this sort of work that you are hoping to avoid and you know pulling in their user code from some git storage and so on. Uh
30:50
and and you sort of miss out on all the advantages of snapshots when you want to make that kind of change. And so with
30:55
directory snapshots, you basically don't have to. Uh so with directory snapshots, you can snapshot the user code separately from your own dependencies.
31:02
Um, and that way you can kind of replace your base image without losing the snapshots advantages that you have um
31:08
from snapshotting specific user projects. I hope that made sense.
31:15
Um, is there a way to use eBPF to inject credentials at the network level?
31:23
Um, we don't provide that yet. We've been thinking uh about some of those things. A lot of
31:30
the trickiness with using something like ebpf for this is that uh you know assuming that we would have to kind of
31:36
do that on the host system above the the VM itself is like when web traffic
31:42
leaves one of these sandboxes it's already encrypted so we can't see it. So
31:48
there are some providers who will kind of man the middle that connection and do connect um
31:55
secret replacement and things like that. Um there's a lot of
32:02
philosophical debate internally of whether that's a a valid thing to do. Honestly, um I I don't like the idea of
32:08
kind of like sitting in the middle of someone's connection and and decrypting
32:14
it and then re-encrypting it. So um we're looking at alternatives to to that approach
32:19
for uh connection uh uh you know uh authentication token
32:26
injection and things like that. Um how do you reduce excess cost with
32:33
sandboxes? How do you generally manage the scaling of worm pools? I can take this one. Um so for cost the way that
32:40
this works for sandboxes you get charged for CPU and memory consumption. Uh when you create a sandbox on modal, you can
32:47
pick an amount of CPU and memory that you request. Uh so this is this should basically represent a best guess for
32:54
what you think your sandbox will use on average. However, our experience is that sandboxes generally are very very bursty
33:00
and their CPU and memory consumption. So you don't usually need the same amount of CPU and memory throughout the entire
33:05
lifetime. And on modal you basically pay only for what you use. Uh so the way to
33:10
kind of reduce costs on sandboxes is to basically go for go for a provider like us. Many other providers will basically
33:16
require you to provision an amount of CPU and memory that's like the max your sandbox can consume and then you pay for
33:22
that the entire lifetime of the sandbox. With modal you don't you can kind of request less and burst above whatever
33:28
you requested. That's one. But then also tuning your request. Um that's sort of the most uh common way to to control
33:35
your sandbox cost is to think about like what what request you actually need. So the request does not need to represent
33:40
your max expected CPU or memory usage. It needs to represent like the expected or average uh usage especially if you're
33:47
running across many sandboxes. Uh and you get charged for the maximum of the requested amount and the actual amount.
33:54
Uh and you get charged by the second. But I think this is the case across all providers that I know of. So every everyone charges by the second for CPU
34:01
and memory usage. The difference is on modal and certain other providers, you sort of can burst above the request and
34:07
only pay for what you use, whereas many others require you to kind of decide upfront um how much memory and CPU
34:12
you're going to have access to and then you pay for all of that. Um does the modal sandbox region
34:20
selection guarantee the chosen region? Additionally, the region docs say all function inputs and outputs go through
34:26
modal's control plane in US East1. Is this also true for sandboxes? Uh so region pinning should guarantee
34:34
it. If you're if you're not seeing that then that's a bug but um yeah if that's
34:40
it's basically what'll happen is if there's not availability in that region uh and you select a region you won't get
34:47
scheduled. So um we generally try to steer people away from region pinning unless there's like a compliance reason.
34:54
Um and then the second part of the question
35:01
uh yes does everything travel through um so for sandboxes for tunnels it does
35:06
not. So when you um create a sandbox and then set up a tunnel to it that tunnel
35:13
connects directly to that sandbox. Um and so if it's a sandbox is scheduled in
35:20
EU um that data is never leaving EU. um similarly to if it's US um unless it's
35:26
traveling you know between the client and the server um outside of that region and I think just to clarify the quotes
35:33
that was in here from the docs it it basically says in the quote like all function inputs and outputs so this
35:38
refers to modal functions which are separate from modal sandboxes um so so this applies to functions specifically
35:44
and not sandboxes uh how does modal snapshot pricing work
35:50
I can take this one it's a simple answer we do not charge for snapshots themselves. Uh we will at some point in
35:56
the future probably charge for storage, but I don't think that's going to be a substantial cost for most users. Um so I
36:03
wouldn't worry about it. Um it's basically a feature that we hope makes modal more valuable, but we don't intend
36:08
to charge for snapshots themselves. I think it'll be sort of roughly in line
36:13
with like the underlying uh cloud storage cost of that. Yep, exactly. Oh, and then we have
36:20
follow-up. Yeah, I didn't cover the worm poolool part. So um does modal maintain any pre-wormed pools or is the only way
36:25
to have wormed instances equal to user having to use the wormed pool feature? Um
36:32
it's it's complicated. We no we don't have any sort of built-in worm poolool functionality although it's something
36:37
we're developing so we will uh soon. However we do maintain a lot of capacity um that we can schedule sandboxes onto
36:44
which is how we are able to schedule sandboxes really fast anyway. Um so so
36:50
no in the official sense u yes s sort of in practice um but it's not yet a
36:56
sandbox uh the thing that we maintain it's capacity that we can schedule sandboxes onto
37:04
um all right I'm going to scroll up because I think there were a few questions here that we did not cover yet
37:11
um does the snapshot runtime itself protect against accessing MCP services in in an
37:18
unauthorized manner. Eg download DB data, delete git repo. If not, then why
37:23
run in a sandbox? Yeah. So sandbox is is not um protecting
37:30
from like calls being made outside of the sandbox. Um unless you you actually
37:36
you can restrict network egress, but um assuming you don't do that, like it can
37:43
the sandbox can call things outside. So if there's a MCP service that you're exposing to it that can do bad things
37:49
outside of the sandbox then um the sandbox itself doesn't protect you from
37:54
that unless you just cut off access to it. And that again goes you know you know way it goes to like that that
38:01
connection once it leaves the sandbox is encrypted and we don't see it. So we don't try to prevent you from doing bad
38:08
things over an encrypted connection. Um the getting back to like the reason the
38:13
core reason of the sandbox is like the sandbox provides that isolated environment that um you can kind of
38:20
whatever anything you don't put into the sandbox um in terms of like user data and things like that it's not exposed
38:27
to. So instead of running say code on a user's machine where it could access all
38:33
kinds of files and things like that um running in a sandbox is you know it's
38:38
it's an isolated environment. Um so yeah hopefully that answers the
38:44
question. Uh can you all elaborate on why agents
38:50
outside the sandbox is the emerging pattern? Oh look at this now. Oh you
38:55
still can't see it. I'm going to continue reading the question because yeah um for agents to utilize the
39:01
codebase as a source of truth, wouldn't the agent need to be running inside?
39:07
Um so I see it as two different things. So there's the the well the the agent itself sees the
39:13
codebase through tool calls generally. So um and this is sort of an emerging
39:18
pattern. At one point, you know, there was the the rag era where uh the agent
39:24
would get a bunch of contexts in advance from the codebase kind of pre-populated into it. Um these days, cloud code kind
39:32
of spearheaded this like the tool calls are really the the way that accesses it. So the way that you can make this work
39:39
where the agent can see the the code even if the agent is sort of running independently is that the tool calls
39:46
cross from the agent world into the sandbox and are handled inside the sandbox. So if you have maybe the agent
39:54
wants to run a GP over the codebase to to sort of find a bunch of relevant files, what it's really doing is making
39:59
a tool call into the sandbox. The GP runs inside that sandbox. Um you also put the whole codebase in that sandbox.
40:05
So that's why it's able to see it. Um, and then you're able to get the results back from that tool call, feed that back
40:12
into the agent. Um, and then you call call out to the LLM from the agent, but again, that that piece of the agent is
40:18
running outside of a sandbox or maybe it's in a different sandbox, but it's not the same sandbox that you're running
40:24
those actual tool calls in. And that just kind of creates that separation.
40:31
Cool. I have a perfect question for you coming up, Paul. Is support for domain whitelisting for network egress not just
40:38
C ranges on the road map? If so, when? It is. Yes. And this is another one that
40:44
kind of gets to that tricky point of like we don't want to read traffic leaving a sandbox. And so for folks
40:52
familiar with like networking in general, um you know that
40:58
what we can see when a packet leaves a sandbox is its IP. we can't see the
41:03
domain it's headed towards. So, there's a few different tricks or different ways we could kind of do this. Um, we're
41:10
still thinking through uh the best one, but likely what we'll do is run a proxy outside of the the sandbox that um
41:18
doesn't allow us to see the traffic, but does allow us to verify that it's at least going to an IP that is valid for
41:25
the domain that it's destined for. Um, but yeah, we're so it's something we're
41:31
very actively thinking about. I would say we don't have an ETA yet on that.
41:37
Great. Uh, can you see the questions now, Paul, by the way? No, I just see I think you can stop I think you can
41:43
stop screen sharing. Stop screen share. Um, but I'll continue reading them. Uh,
41:48
can we talk a bit more about the difference between functions and sandboxes? You can mount the volume and call subprocess.pop
41:55
to execute a process from a function. What's the difference between this and calling sandbox?
42:02
Yeah. Um, so the it's actually valid to, you know, to do subprocess P open in a
42:09
modal function. Um, and you can like
42:14
there there have been cases where we actually do recommend people use functions like sandboxes. Um, there are
42:20
a few precautions that you want to take in that case. Um so you want to make sure that uh each of those functions is
42:26
not handling different requests concurrently or even subsequently
42:31
because um you don't want you kind of want to not break that isolation. So you
42:36
can use max inputs equals one for that. Um also functions by default receive modal credentials so that they can make
42:43
API calls to modal. Um you also want to disable that. We have a um a parameter
42:49
that you can use for that. uh when you decorate the function. Um aside from that, it really comes down to whether
42:57
there are features of functions that you want um to use. Like this is actually a
43:02
really ends up being a really nice way to just sort of create uh warm pool um
43:07
is to use modal functions even if you're running arbitrary commands. Um as long
43:13
as you kind of take those precautions. Um the other thing is you you know you need to you need to be calling this if
43:18
it's a function you need to be calling it from uh or at least declaring it in Python. You like there's still
43:25
a Python sort of layer that runs in that container. Um with sandboxes you kind of
43:31
just get a a raw container. Um so both are valid um as long as you make sure
43:37
you're careful with with those max inputs and um not passing the model credentials. But it really just matters.
43:43
It's just a matter of which form factor you like better.
43:49
Great. Is there an option to increase a sandbox timeout after it has been
43:54
started? Um, we don't have this at the moment.
43:59
What we do have is a concept of an idle timeout where uh if you don't call exec
44:06
for a while or don't have uh open connections to a sandbox um we'll
44:11
terminate it after a certain amount of time. So you could kind of
44:17
hopefully get the effect that you want with this. Um, as we think about first
44:22
class warm pools, this is something that I think is going to come up again. Um, so we'll hopefully have a better answer
44:27
for that. Um, and we've gotten a question that I'm
44:32
not sure either of us know the answer to. Uh, if there's any examples of the outside pattern in the examples repo, do
44:37
you know off the top of your head, Paul? Um, so the the modal vibe the the demo
44:43
that I showed um is sort of an example of this. I think it's a little bit um
44:48
yeah I mean I guess it's there is some some sort of the one difference is that it kind of waits for the user interaction. It doesn't do multiple
44:56
steps autonomously um on its own but it essentially does implement that pattern.
45:02
Um, so what really happens there is it sort of um, you know, it's taking the
45:08
prompt. All of this runs in like a modal function that's not a sandbox. Um, but when it receives that prompt, it kind of
45:13
goes out to the LLM, gets some stuff generated, opens the sandbox, sends it to the sandbox, and um, and as you
45:19
iterate, as you continue to iterate, it kind of goes, you know, back to the LLM and then into the sandbox. But the that
45:25
loop is not running in the sandbox. It's it's running in a modal function.
45:31
Um, I think we're soon out of questions, but here's an interesting one about sort of compute SDK benchmarks. Can you see
45:38
it? No, I'll read it. Uh, yes. Okay, I'll read it anyway for everyone else's sake. Um, I have been benching
45:44
various permutations since that compute SDK post a few days ago. The one that E2B Daytona architectures uh shows
45:49
spinning up in 0.2 to 3 seconds. Models seems to constantly pull one. Two to two seconds. My question is does modal not
45:56
have worm pools for some common set of common/default parameter images? E2B and Daytona have sort of a smaller space of
46:02
image configs which lets them have an advantage when using worm pools. When I warm modal sandboxes, I can get 0.3
46:07
times and less on concurrent hits once uh gRPC kicks in.
46:13
Yeah, this is actually this you know that those saw those benchmarks as well and they kicked off this discussion
46:18
internally of like should we should we kind of be doing this uh as well and um
46:24
I think one of the things that that's come up is like when we when we do this at scale for enterprise customers like
46:30
they don't want the base image that um that this benchmark actually tests. So I
46:36
think that this this benchmark is great for you know what um what somebody just
46:42
sort of experimenting with a sandbox and running a few exec calls is is doing but um not really somebody who's deployed a
46:48
sandbox in production where it needs to load an image and um probably has some startup tasks and and things like that.
46:53
So for those use cases what we really see is people building warm pools uh
46:59
around their own images. And you know, one of the things that's been tricky about uh about like building
47:07
first class support for worm pools is that what you want to do in a worm poolool is different from use case to
47:13
use case. So sometimes it's a matter of just you want the image to be loaded, but sometimes there's a process you want
47:19
to run, sometimes there's some pre-work you want to do. Um so the approach to
47:24
sort of allow the customer to build the warm pool has been um sort of the maximally flexible option here. Um, and
47:32
I do think, you know, so I I it's awesome that EDB and Daytona
47:38
have had like really great um cold starts on on these metrics, but I think, you know, for what we're optimizing for,
47:44
it's uh we think that this is sort of less uh of the big issue.
47:54
Uh, cool. There was a followup to the idle timeouts question. Um, the sandbox isn't idle if a TCP connection is open.
48:00
So in the lovable case where a demon with in the with the demon a TCP connection would be open. Uh how do they
48:06
handle the timeout and termination of sandboxes? Um I can say like in general this type of customer will usually
48:13
handle uh sort of they will have their own logic uh outside of the sandbox for sort of pinging it regularly uh checking
48:19
if it's idle and determining sort of from outside uh whether it's time to shut down the sandbox.
48:24
So the common pattern is I was going to say you can also do it from inside the sandbox too. So like if
48:30
you have, you know, a vite server, something like that, you could have that just have some hook to um receive a ping
48:40
from the from the client and then if it's still active or if you just don't
48:45
have any input for a while um you can shut down the process and once you shut
48:50
down the process that frees up the sandbox. But basically the recommended pattern
48:56
here is pick a long timeout and then take control of shutting down the sandbox using custom logic if you're
49:02
operating at sca this scale and with this sort of need of granular control.
49:07
Um any plans for full TypeScript SDK support? If I remember correctly, the functions and sandbox operations require
49:14
Python. Uh sandboxes should be fully supported uh in uh TypeScript already.
49:19
um let us know if not there might be sort of some minor stuff missing but uh I think we're very close to full feature
49:25
parody on uh sandbox operations functions is a different story um that's
49:32
likely to not be supported uh in the typescript SDKs we basically the uh the
49:37
go and typescript SDKs are generally mostly used by sandbox users um so that
49:43
makes sort of worm pools a little bit tricky but as we've sort of alluded to already we have built-in support coming up for that in general general you
49:49
usually don't need functions in order to use sandboxes on modal. Um so you can usually u be fine without
49:57
yeah I think you know for some of historical context like modal the first interface to modal was sort of
50:03
decorating Python functions and and sort of getting this really magical deployment experience. Um and then for
50:09
sandboxes, yeah, we treat sandboxes as like it should have support in Go and
50:16
TypeScript. Um at the same level as Python. Um I think historically we've
50:21
there's been some differences, but going forward our the SDK team's been pretty
50:26
clear that you know we need to uh provide support for all languages equally.
50:34
Um cool. Uh can we uh can we make
50:39
sandbox communication pubs subob using cues kafka instead of websockets? Yeah, so you can make outgoing
50:45
connections from a uh from a sandbox. So as long as you can kind of provide some
50:52
sort of ideally shortlived uh authentication token or or credential um
50:57
you could totally have them either in or outbound. Um, when it comes to inbound
51:02
connections, ideally it's a do use something that can support TLS. Um, but we also have
51:10
unencrypted tunnels. Um, they're just not as yeah, they go through a relay, so
51:15
it's uh not as direct, but um, yeah, you can use any protocol that uh, you can
51:22
send over TCP. Cool. Is it possible to have an agent in
51:30
a sandbox that wants to run scary commands like curl uh to be able to run them in another more isolated sandbox? So sandbox is calling sandboxes with
51:37
different kind of isolation. Yeah. And I think this is a good pattern. Um the this kind of gets back
51:45
to sort of like having a separate agent and code execution. So you could spin up a um sandbox that has modal credentials
51:53
to spin up its own sandbox. Um, I think that's a good way to do it. You could also use a modal function for that first
51:59
one because then you get those modal credentials for free. Um, so yeah, a matter of ergonomics,
52:07
but this is generally a pattern we are thinking a lot about and are sort of thinking about how to best support. So
52:12
we we think this makes a lot of sense. Yeah. Um, what's the best practice around
52:18
receiving logs from the sandbox? We want to store them so we can later inspect the telemetry from sandbox sessions.
52:24
Yeah. So we can do uh hotel export and data dog export. Um so that's the most
52:31
common way to do it. Um they're also just logs available on on the dashboard for like manual inspection. But for
52:38
programmatic export I think hotel and data dog are the primary ways we do
52:43
that. Cool. I think we're running out of
52:48
questions and the last one we got is the perfect segue I think to uh the last thing we have to mention. uh modal
52:55
credits. Uh yes, there will be modal credits for everyone who has joined today. Uh so if this whole session has
53:01
has made you excited about trying out modal, what you can do is you can go to modal.com. You can sign up for account. Um everyone by default gets $30 of
53:08
credits every month. Uh but all everyone who's attending this uh webinar will also get $250 in credits so that you can
53:15
experiment even more uh and use sandboxes. You'll get those credits in a follow-up email after this. And
53:20
basically the way to the recommended way to get started is to start by cloning one of our examples. Um the open code
53:26
one I think is really cool. It's one of our most recent ones. Um but there's plenty listed um on our website. There's
53:32
plenty if you go to our docs there's like a list of examples and there's even more on GitHub. So you can almost
53:38
certainly find an example that's relevant to what you're trying to do. Um so that's the usually the recommended
53:43
starting point. Uh pick one of the examples, clone it, run it, and start modifying it.
53:48
And I think that's it. Um, we've basically covered everything that we
53:54
intended to cover. Um, if you have any more questions, uh, you can reach out to us in our community Slack. Uh, we
53:59
generally monitor that and answer questions. There's a, um, I forget what it's called, but there's a specific channel for coding for sandboxes or for
54:07
coding agents. I can't remember. I think it's code sandboxes. Code sandbox. Code sandboxes. Yeah.
54:13
Um, so you can get in touch with us there. Uh and uh yeah, happy happy coding. Hope this was helpful.
54:22
Thanks everyone. Thank you.


SOMEWHERE IN THIS TRANSCRIPT – please reseach. I'd like to implement this, or otherwise "agent in sandbox". 

We could have all the processing happen in modal and return us the finished transcription, that would be really cool too