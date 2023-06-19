
import * as autoscaling from './autoscaling';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets'; // Allows building the docker image and uploading to ECR
import * as path from "path"; // Helper for working with file paths
import * as cdk from 'aws-cdk-lib';
import { aws_apprunner as apprunner, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { TagStatus } from "aws-cdk-lib/aws-ecr";


export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

        //If you are running on a Mac using the new M1 chip, please change `../SampleApp` to `../../SampleApp`.
        const imageAsset = new DockerImageAsset(this, 'ImageAssets', {
          directory: path.join(__dirname, '../../Docker'),
        });

        // Create an ECR repository
        const repository = new ecr.Repository(this, 'Service-builds', {
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          imageScanOnPush: true,
        });

        repository.addLifecycleRule({
          tagStatus: TagStatus.ANY,
          maxImageCount: 10
        });
        repository.addLifecycleRule({
          tagStatus: TagStatus.UNTAGGED,
          maxImageAge: Duration.days(1),
        });

        const autoscalingConfiguration = new autoscaling.AppRunnerAutoScaling(this, 'app');

        const appRunnerRole = new iam.Role(
          this,
          `${this.stackName}-apprunner-role`,
          {
            assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
            description: `${this.stackName}-apprunner-role`,
            inlinePolicies: {
              "kotlintest-apprunner-policy": new iam.PolicyDocument({
                statements: [
                  new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["ecr:GetAuthorizationToken"],
                    resources: ["*"],
                  }),
                  new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                      "ecr:BatchCheckLayerAvailability",
                      "ecr:GetDownloadUrlForLayer",
                      "ecr:GetRepositoryPolicy",
                      "ecr:DescribeRepositories",
                      "ecr:ListImages",
                      "ecr:DescribeImages",
                      "ecr:BatchGetImage",
                      "ecr:GetLifecyclePolicy",
                      "ecr:GetLifecyclePolicyPreview",
                      "ecr:ListTagsForResource",
                      "ecr:DescribeImageScanFindings",
                    ],
                    resources: [
                      repository.repositoryArn
                    ],
                  }),
                ],
              }),
            },
          }
        );

        // Push the Docker image to the ECR repository
        imageAsset.repository = repository;

        const cfnService = new apprunner.CfnService(this, 'Service', {
          sourceConfiguration: {
            authenticationConfiguration: {
              accessRoleArn: appRunnerRole.roleArn,
            },
            autoDeploymentsEnabled: true,
            imageRepository: {
              imageIdentifier: imageAsset.imageUri,
              imageRepositoryType: 'ECR',
              imageConfiguration: {
                port: '8080'
              },
            },

          },
          instanceConfiguration: {
            cpu: '1024',
            memory: '2048',
          },
          autoScalingConfigurationArn: autoscalingConfiguration.arn,
        });
    
        new cdk.CfnOutput(this, "apprunner-url", {
          exportName: "apprunner-url",
          value: cfnService.attrServiceUrl,
          description: "URL to access service"
        });
  }
}
