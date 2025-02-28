URL: https://docs.replit.com/replit-workspace/workflows
---
[Replit home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/replit/logo/light.svg)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/replit/logo/dark.svg)](https://docs.replit.com/)

Search or ask...

Ctrl K

Search...

Navigation

Replit Workspace

Intro to Workflows

It is a reusable, customizable sequence of steps that can be executed within your replit app. They can be as simple as running `python main.py` or as complex as executing a multi-step procedure.

Example Use Cases:

- Run multiple services in parallel (e.g., frontend + backend)
- Execute files or commands sequentially (e.g., run linter → run tests, compile → execute code)

To start [creating workflows](https://docs.replit.com/replit-workspace/workflows#creating-workflows), go to the Workflows pane by using the tools sidebar menu, or search for the Workflows pane using `Command + K`.

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/workflows-pane.png)

## [​](https://docs.replit.com/replit-workspace/workflows\#available-task-types)  Available Task Types

There are current 3 type of tasks available, `Execute Shell Command`, `Install Packages`, and `Run Workflow`.

### [​](https://docs.replit.com/replit-workspace/workflows\#execute-shell-command)  Execute Shell Command

`Execute Shell Command` stores a shell command and executes it using the same environment as the Shell pane. This task type offers a wide range of use-cases, from running individual files:

Copy

```text
python main.py

```

to executing complex stored database query commands:

Copy

```text
psql -h 0.0.0.0 -U your_username -d your_database -c "SELECT * FROM your_table;"

```

Example use case:

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/shellExec-task-example.gif)

### [​](https://docs.replit.com/replit-workspace/workflows\#install-packages)  Install Packages

`Install Packages` utilizes replit’s built-in dependency management system, automatically detecting your project dependencies and installing the necessary packages for your project. See [Dependency Management](https://docs.replit.com/replit-workspace/dependency-management.md#the-universal-package-manager) for more details on how UPM guesses packages to install for your project under the hood.

Example use case:

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/packager-task-example.webp)

### [​](https://docs.replit.com/replit-workspace/workflows\#run-workflow)  Run Workflow

`Run Workflow` allows you to run another workflow from the current workflow. This allows for reusing workflows and combining them to create more complex workflows.

Example use case:

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/example-run-workflow.webp)

By using this task type for creating dependencies between workflows, you can edit one workflow and have other workflows referencing it automatically use the latest changes. Note that there is a depth limit placed on deeply nested workflow calls.

## [​](https://docs.replit.com/replit-workspace/workflows\#workflow-execution-mode)  Workflow Execution Mode

Workflows offer two different modes of execution: sequential and parallel.

### [​](https://docs.replit.com/replit-workspace/workflows\#sequential)  Sequential

Sequential execution will run each task in the defined order, waiting for each task to finish before moving on to the next step, and stopping execution of the sequence if a task within the workflow failed.

An example of using this mode is for defining commands that are logically connected, such as git commands for fetching the latest changes from your main branch, then rebasing your current branch on the main branch:

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/example-sequential-workflow.png)

### [​](https://docs.replit.com/replit-workspace/workflows\#parallel)  Parallel

Parallel execution will run each task in parallel, such that each task is started and runs independently of other tasks within the workflow. One task failing does not stop the execution of other tasks.

An example of using this mode is running a fullstack project that needs to start both the frontend and the backend server:

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/example-parallel-workflow.png)

## [​](https://docs.replit.com/replit-workspace/workflows\#creating-workflows)  Creating Workflows

Workflows can be created using the workflows pane by clicking on the `+ New Workflow` button. Start by giving your workflow a descriptive name, chose a suitable mode of execution, and start adding tasks. Tasks can be re-ordered by dragging and dropping them into the desired order.

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/example-workflow-setup.webp)

## [​](https://docs.replit.com/replit-workspace/workflows\#assign-workflow-to-run-button)  Assign Workflow to Run Button

A workflow can also be assigned to the run button to replace the default run button behavior (see [Configure a Replit App](https://docs.replit.com/.replit.com/replit-workspace/configuring-repl)). To keep the default run command configured within `.replit`, select the default “Run Replit App” option within the dropdown.

The selected workflow within the dropdown menu next to the run button will be run when the run button is clicked. Click on your desired workflow within the dropdown menu to change which workflow should be run by the run button.

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/configure-run-button-workflow.gif)

## [​](https://docs.replit.com/replit-workspace/workflows\#viewing-workflow-outputs)  Viewing Workflow Outputs

Workflow outputs will be displayed in the `Console` pane. You can toggle the display to only display latest outputs and clear the console altogether.

![image](https://mintlify.s3.us-west-1.amazonaws.com/replit/images/workflows/workflow-output-view.gif)

Was this page helpful?

YesNo

[Previous](https://docs.replit.com/replit-workspace/configuring-repl) [Dependency ManagementReplit supports a variety of languages and dependency management systems through the Dependencies tool. This section will cover the different types of dependencies and how to manage them in your Replit App.\\
\\
Next](https://docs.replit.com/replit-workspace/dependency-management)

On this page

- [Available Task Types](https://docs.replit.com/replit-workspace/workflows#available-task-types)
- [Execute Shell Command](https://docs.replit.com/replit-workspace/workflows#execute-shell-command)
- [Install Packages](https://docs.replit.com/replit-workspace/workflows#install-packages)
- [Run Workflow](https://docs.replit.com/replit-workspace/workflows#run-workflow)
- [Workflow Execution Mode](https://docs.replit.com/replit-workspace/workflows#workflow-execution-mode)
- [Sequential](https://docs.replit.com/replit-workspace/workflows#sequential)
- [Parallel](https://docs.replit.com/replit-workspace/workflows#parallel)
- [Creating Workflows](https://docs.replit.com/replit-workspace/workflows#creating-workflows)
- [Assign Workflow to Run Button](https://docs.replit.com/replit-workspace/workflows#assign-workflow-to-run-button)
- [Viewing Workflow Outputs](https://docs.replit.com/replit-workspace/workflows#viewing-workflow-outputs)

![image](https://docs.replit.com/replit-workspace/workflows)

![image](https://docs.replit.com/replit-workspace/workflows)

![image](https://docs.replit.com/replit-workspace/workflows)