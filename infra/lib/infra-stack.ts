
import * as autoscaling from './autoscaling';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets'; // Allows building the docker image and uploading to ECR
import * as path from "path"; // Helper for working with file paths
import * as cdk from 'aws-cdk-lib';
import { aws_apprunner as apprunner } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';


export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
        const imageAsset = new DockerImageAsset(this, 'ImageAssets', {
          directory: path.join(__dirname, '../../Docker'),
        });

        const autoscalingConfiguration = new autoscaling.AppRunnerAutoScaling(this, 'app');

        const appRunnerRole = new iam.Role(
          this,
          `${this.stackName}-apprunner-role`,
          {
            assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
            description: `${this.stackName}-apprunner-role`,
          }
        );
        appRunnerRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSAppRunnerServicePolicyForECRAccess"));

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
