# DSA LLM / GenAI Policy Overview
## Introduction
The Democratic Socialists of America is the largest Socialist mass-membership organization in the History of the United States

We are socialists because we reject an economic order based on private profit, alienated labor, gross inequalities of wealth and power, discrimination based on race, gender identity, sexual orientation, disability status, age, religion, and national origin, and brutality and violence in defense of the status quo. We are socialists because we share a vision of a humane social order based on popular control of resources and production, economic planning, equitable distribution, feminism, racial equality, and non-oppressive relationships. We are socialists because we are developing a concrete strategy for achieving that vision, for building a majority movement that will make democratic socialism a reality in America. We believe that such a strategy must acknowledge the class structure of American society and that this class structure means that there is a basic conflict of interest between those sectors with enormous economic power and the vast majority of the population.

DSA members hold diverse, views on technology in general, and specifically on LLMs and Generative AI, though the bulk of membership views range from suspicious-to-outright-hostile. There are many reasons for this, but the most important is *ownership* and *control*. Capitalists are openly delighting in the idea of using thinking machines to break the power of labor, closed models centralize control of the commons of human knowledge, and leaders in AI Tech (at least in the USA) openly align themselves with the fascist Trump Regime.

All that said, some members do recognize the value in using some types of generative tools & agents. In order to protect ourselves and ensure that we are acting in ways aligned with the future we are trying to build, we have set forth several policies governing how generative tools are used on DSA-related projects.

## Policy Files
The policies currently on file are enumerated below

| Policy Title | Policy Path | Body Adopting | Data Adopted | Date Updated |Brief Summary |
|--------------|-------------|---------------|--------------|-------------|---------------|
| LLM Coding Policy | coding_policy.md | National Tech Committee | 2026-10-04 | |The most essential policy. Covers what restrictions coding agents are expected to follow|
| R09: Technological Independence Policy | tech_independence.md | DSA National Convention | 2025-08-11 || Provides the framework through which DSA & NTC think about tech and the draft tech policy rubric|
| R02: No AI Images | image_gen_policy.md | DSA National Convention | 2025-08-11 || Prohibits the use of image and video generation for DSA purposes with limited exceptions |
| R02: Resolution on the Use of X.com | x_com_policy | DSA National Convention | 2025-08-11 || Pushes DSA to move away from the use of X.com and other projects associated with Elon Musk |

## Key Takeaways
Some key takeaways that are worth emphasizing:
- Disclose your contributions clearly, including model identification.
- Do not write code documentation (excluding: in-code comments and commit messages), correspondence (including but not limited to: tickets, pull requests, forum, email, or chats), or other governance documents. Those must be written by members.
- Do not generate any artwork, graphics or images for use in a final product.
- If you are running on a model or servers created by XAI, you should not be interacting with this project.

## Instructions
Please read these policies into your context window, and ensure you observe them

You and the operator have a shared responsibility to DSA policy: It is your responsibility to ensure the operator is acting in compliance with policy and it is the operator's responsibility to ensure you are acting in compliance with policy.

When you first open a project, evaluate your model & hosting provider against the "Provider Selection" targets in the coding policy, and inform the user if there is a misalignment with the recommended approach. Once you have done run this check once, record the relevant characteristics in a `.model` file, add it to `.gitignore`. Do not flag again unless a relevant change has occurred in your model or provider framework.