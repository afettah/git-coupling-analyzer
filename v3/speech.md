Large-Scale Codebase Migration with Multi-Agent Systems
Live Demo Setup on the OpenHands Repository

Apologies — we’re not going to play the video. Instead, I’ll attempt to run this demo live.

Let’s assume we are working on the OpenHands codebase itself and trying to make large-scale modifications. For example:

Improving overall code quality

Removing lingering TODO comments

Eliminating notes intended for agents

Cleaning up outdated or irrelevant comments

Even if we focus only on the agent-specific part of the OpenHands codebase, we’re dealing with:

Nearly 400 Python files

Approximately 60,000 lines of code

This is far too large for a single agent to process within one context window. It’s a perfect use case for batching and running multiple agents simultaneously.

Visualizing Dependencies and Batching Files

To better understand the repository, we use a prototype tool that visualizes it as a graph:

Each node represents a file.

Each edge represents a dependency between files.

When zoomed in, the graph looks simple. But zooming out reveals the complexity of making even small changes across the entire codebase.

Every change modifies one file — but since files import and depend on one another, changes propagate. This creates risks:

Unexpected side effects

Agents interfering with one another

Merge conflicts

We need a way to manage this complexity.

Batching Strategy

We developed a mechanism called batching.

Instead of modifying files one by one (which would be unrealistic and inefficient), we group related files together into meaningful chunks — similar to how a human engineer would organize pull requests.

Batching strategies depend on your goal. Some approaches use graph-theoretic algorithms to avoid cycles. For this demo, we group files based on file structure.

After batching:

Nodes sharing functionality are grouped together.

They are color-coded to indicate batch membership.

Each batch is assigned to an agent.

We can also collapse the graph so each batch becomes a single node. This simplifies the problem dramatically:

Instead of hundreds of files, we now manage a smaller number of logical units.

Horizontal vs. Vertical Task Decomposition

There are two key ways to decompose tasks:

1. Horizontal Decomposition

We partition the codebase into independent batches so agents can work in parallel without stepping on each other’s toes.

2. Vertical Decomposition

We break the migration into stages:

Verification stage

Fixing stage

Rather than treating the task as a monolithic “remove all TODOs,” we:

Verify whether a change is necessary.

Apply fixes only where required.

Verification and Fix Pattern

Each batch supports two operations:

Verification

We pass the files to a language model with a prompt such as:

Ensure there are no TODO comments, no comments intended solely for AI, and no references to outdated source code.

The model analyzes the files and returns a result:

Green → No changes needed

Red → Issues detected

Important principle:

Don’t use an LLM when a static tool will do the job better.

For example:

Use mypy for type checking.

Use static analyzers for deterministic validations.

Use LLMs for fuzzy or subjective evaluations.

Fixing Stage

When verification returns red:

We spin up an OpenHands agent.

Create a clean Git worktree.

Clone the code.

Apply changes.

Open a pull request.

This isolation ensures agents do not interfere with one another.

Turning the Graph Green

After verification:

Green nodes are complete.

Red nodes require fixing.

The goal becomes simple:

Turn the entire graph green.

Because batches are dependency-aware, we can:

Start with nodes that have no incoming dependencies.

Verify them.

Unlock dependent nodes.

Proceed inward toward core logic.

This gives us a natural migration order.

Principles of Good Task Decomposition

A well-decomposed task should be:

Small enough to complete in one commit

Executable in parallel

Verifiable by a human

Clearly ordered by dependency

One-Shotability

Tasks should be small enough that an agent can complete them without human intervention (other than final verification).

Smaller tasks → higher success rate → less supervision.

Decomposition Strategies for Large Codebases
1. Logical Unit Enumeration

Break tasks by:

Module

File

Class

Function

Ideal for simple syntax transformations like:

Removing comments

Upgrading Python 2 to Python 3

Adding type annotations

Always validate with static tools when possible.

2. Dependency-First Strategy

Start with files that:

Have the fewest imports

Sit at the edge of the dependency graph

Gradually move inward toward core business logic.

This ensures dependencies are validated before modifying central components.

3. Scaffolding Strategy

This is ideal for large migrations that must keep the application functional throughout.

Example: React State Management Migration

Instead of replacing everything at once:

Introduce a scaffold layer.

Allow old and new systems to coexist.

Use feature flags or environment variables.

Migrate components incrementally.

Validate equivalence.

Remove the scaffold once complete.

This enables partial migration while maintaining a working system.

Agents are especially good at setting up scaffolds.

Managing Multiple Agents
Context Sharing

Agents learn as they work. That knowledge can benefit others.

Strategy 1: Share Full Context

All agents inherit previous trajectories.

Problem:

Expands context window dramatically

Slows performance

Adds irrelevant information

Not ideal.

Strategy 2: Human-Curated Context

Humans review agent output and record:

What worked well

What failed

Important constraints

Pros:

High quality

Targeted

Cons:

Requires human effort

Strategy 3: Shared Learning File

Agents update a shared file (e.g., agents.md) with discoveries.

Humans review changes in pull requests.

Limitations:

Agents may record irrelevant information.

In-progress agents won’t see updates until restart.

Strategy 4: Direct Message Passing

Agents communicate via messaging tools.

Pros:

No human mediation required.

Dynamic knowledge exchange.

Challenges:

Agents must understand each other’s roles.

More complex orchestration.

Risk of cascading context expansion.

Handling Merge Conflicts

Two approaches:

Prevent conflicts
Partition tasks so agents modify independent code regions.

Resolve conflicts
Agents can be surprisingly effective at resolving merge conflicts when prompted to consider original commit intent.

Code Review with AI

Code review is becoming a bottleneck.

Recommendations:

Use AI for structured code review.

Provide specific review criteria.

Limit unnecessary AI-generated changes.

The more you constrain generation, the easier review becomes.

Ensuring Behavioral Equivalence

Beyond regression tests:

Add unit tests (even AI-generated ones).

Validate subprogram behavior.

Consider API exposure guarantees in legacy systems.

The goal is observational equivalence, not necessarily identical code.

Lessons Learned

Smaller tasks outperform larger ones.

Dependency-aware batching reduces conflicts.

Static tools should handle deterministic checks.

Scaffolding enables safer migrations.

Context must be curated carefully.

Code review is the emerging bottleneck.

OpenHands Q1 Pilot Program

For teams with:

Multiple engineers touching the same repo

Modernization and maintenance workloads

Urgent backlogs

The OpenHands pilot offers:

Forward-deployed engineer support

Configuration and deployment guidance

Bi-weekly feedback loops

Dedicated Slack channels

No-cost evaluation

Closing Thoughts

Large-scale code migration with agents is possible — but it requires:

Careful task decomposition

Dependency awareness

Clear verification stages

Controlled context sharing

Strategic orchestration

When done correctly, multi-agent workflows can transform massive codebases safely and efficiently.